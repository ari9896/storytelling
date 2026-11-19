import ReadingProgress from '../models/readingProgress.model.js'
import { resumeChapterId } from './readingProgress.controller.js'
import mongoose from 'mongoose'
import { ensureChapterNotificationIndexes, notifyNewChapters } from '../lib/chapterNotifications.js'
import { loadStory } from '../lib/storyRepository.js'
import { canReadChapter } from '../lib/storyAccess.js'
import { retiredStorySlugs } from '../lib/retiredStories.js'
import { randomUUID } from 'node:crypto'
import Story from '../models/story.model.js'
import cloudinary from '../lib/cloudinary.js'

const validText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max
export const validateStoryInput = (body, allowExistingImages = false) => {
  if (!body || !validText(body.title, 200)) return 'Enter a story title (up to 200 characters).'
  if (!Array.isArray(body.chapters) || !body.chapters.length || body.chapters.length > 50) return 'Add between 1 and 50 chapters.'
  if (body.plannedChapterCount != null && (!Number.isInteger(body.plannedChapterCount) || body.plannedChapterCount < body.chapters.length || body.plannedChapterCount > 10000)) return 'Planned chapter count must be a whole number between the available chapter count and 10,000.'
  if (body.authorNote != null && (!validText(body.authorNote.title, 200) || !validText(body.authorNote.text, 100000))) return 'Complete the author note title and text.'
  let totalBytes = 0
  if (body.thumbnail != null) {
    const image = body.thumbnail
    if (!(allowExistingImages && typeof image.publicId === 'string' && !image.data)) {
      if (typeof image.data !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.data)) return 'Choose a valid thumbnail image.'
      const size = Buffer.byteLength(image.data.split(',')[1], 'base64')
      if (size > 5 * 1024 * 1024) return 'Thumbnail must be 5 MB or smaller.'
      totalBytes += size
    }
  }
  for (const chapter of body.chapters) {
    if (!chapter || !validText(chapter.title, 200) || !validText(chapter.text, 100000)) return 'Every chapter needs a title and text.'
    if (!Array.isArray(chapter.images) || chapter.images.length > 5) return 'Each chapter can have up to five pictures.'
    for (const image of chapter.images) {
      if (image?.explanation != null && (typeof image.explanation !== 'string' || image.explanation.length > 2000)) return 'Image explanations can be up to 2,000 characters.'
      if (allowExistingImages && image?.publicId && !image.data) continue
      if (!image || typeof image.data !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.data)) return 'Choose PNG, JPEG, WebP, or GIF pictures.'
      const size = Buffer.byteLength(image.data.split(',')[1], 'base64')
      if (size > 5 * 1024 * 1024) return 'Each picture must be 5 MB or smaller.'
      totalBytes += size
    }
  }
  if (totalBytes > 25 * 1024 * 1024) return 'Story pictures must total 25 MB or less per save.'
  return null
}

export const readerStory = (story, user) => ({
  creatorId: story.creatorId ? String(story.creatorId) : null,
  id: story.slug, title: story.title, description: story.description,
  plannedChapterCount: story.plannedChapterCount || null, availableChapterCount: story.chapters.length,

  coverImage: story.thumbnail?.url || null, coverAlt: story.thumbnail?.alt || '', label: 'Story',
  slides: [
    ...(story.authorNote ? [{ type: 'note', title: story.authorNote.title, text: story.authorNote.text }] : story.storytellerNote ? [{ type: 'note', title: 'A note from the storyteller', text: story.storytellerNote }] : []),
    ...story.chapters.map((chapter, index) => ({
      type: 'story', chapterId: String(chapter._id), chapter: chapter.number, title: chapter.title,
      locked: !canReadChapter(story, index, user),
      ...(canReadChapter(story, index, user) ? { text: chapter.text, images: chapter.images.map(image => ({ url: image.url, alt: image.alt, explanation: image.explanation || '' })) } : {}),
    })),
  ],
})

export const createStory = async (req, res) => {
  const error = validateStoryInput(req.body)
  if (error) return res.status(400).json({ error })
  const hasImages = !!req.body.thumbnail || req.body.chapters.some(chapter => chapter.images.length)
  if (hasImages && !['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every(key => process.env[key]?.trim())) return res.status(503).json({ error: 'Cloudinary uploads are not configured.' })
  const uploaded = []
  let saved = false
  try {
    const slug = 'story-' + randomUUID()
    const thumbnail = req.body.thumbnail ? await uploadThumbnail(req.body.thumbnail, slug, uploaded) : null
    const chapters = []
    for (const [index, chapter] of req.body.chapters.entries()) {
      const images = []
      for (const image of chapter.images) {
        const asset = await cloudinary.uploader.upload(image.data, { folder: `storytelling/stories/${slug}`, resource_type: 'image', allowed_formats: ['png', 'jpg', 'jpeg', 'webp', 'gif'] })
        uploaded.push(asset.public_id)
        images.push({ url: asset.secure_url, publicId: asset.public_id, alt: typeof image.alt === 'string' ? image.alt.slice(0, 500) : '', explanation: image.explanation || '' })
      }
      chapters.push({ number: index + 1, title: chapter.title.trim(), text: chapter.text, images })
    }
    const story = await Story.create({
      creatorId: req.user._id,
      title: req.body.title.trim(), slug,
      plannedChapterCount: req.body.plannedChapterCount ?? null,
      description: chapters[0].text.slice(0, 180),
      thumbnail,
      authorNote: req.body.authorNote ? { title: req.body.authorNote.title.trim(), text: req.body.authorNote.text } : null,
      chapters,
    })
    saved = true
    return res.status(201).json(readerStory(story, req.user))
  } catch {
    if (!saved) await Promise.allSettled(uploaded.map(id => cloudinary.uploader.destroy(id)))
    return res.status(500).json({ error: 'Unable to save your story. Your editor has been kept; please try again.' })
  }
}

export const listStories = async (_req, res) => {
  try {
    const stories = await Story.find({ deletedAt: null, slug: { $nin: retiredStorySlugs } }).select('title slug description thumbnail').sort({ createdAt: -1 }).lean()
    return res.json(stories.map(story => ({ id: story.slug, title: story.title, description: story.description, coverImage: story.thumbnail?.url || null, coverAlt: story.thumbnail?.alt || '', label: 'Story' })))
  } catch { return res.status(500).json({ error: 'Unable to load saved stories.' }) }
}

export const getStory = async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store')
    const story = await loadStory(req.params.slug)
    if (!story) return res.status(404).json({ error: 'Story not found.' })
    const progress = req.user ? await ReadingProgress.findOne({ userId: req.user._id, storyId: story._id }).lean() : null
    return res.json({ ...readerStory(story, req.user), resumeChapterId: resumeChapterId(story, req.user, progress) })
  } catch { return res.status(500).json({ error: 'Unable to load this story.' }) }
}

export const requireStoryOwner = async (req, res, next) => {
  try {
    if (retiredStorySlugs.includes(req.params.slug)) return res.status(404).json({ error: 'Story not found.' })
    const story = await Story.findOne({ slug: req.params.slug, deletedAt: null })
    if (!story) return res.status(404).json({ error: 'Story not found.' })
    if (!story.creatorId || String(story.creatorId) !== String(req.user._id)) return res.status(403).json({ error: 'Only the creator can edit this story.' })
    req.ownedStory = story
    return next()
  } catch { return res.status(500).json({ error: 'Unable to check story ownership.' }) }
}

export const getStoryEditor = (req, res) => {
  const story = req.ownedStory
  return res.json({ id: story.slug, version: story.__v, title: story.title, plannedChapterCount: story.plannedChapterCount || null,
    thumbnail: story.thumbnail || null,
    authorNote: story.authorNote || (story.storytellerNote ? { title: 'A note from the storyteller', text: story.storytellerNote } : null),
    chapters: story.chapters.map(chapter => ({ id: String(chapter._id), title: chapter.title, text: chapter.text,
      images: chapter.images.map(image => ({ url: image.url, alt: image.alt, explanation: image.explanation || '', publicId: image.publicId })) })),
  })
}

export const updateStory = async (req, res) => {
  const story = req.ownedStory
  const validation = validateStoryInput(req.body, true)
  if (validation) return res.status(400).json({ error: validation })
  if (req.body.version !== story.__v) return res.status(409).json({ error: 'This story has changed. Reload the editor before saving again.' })
  const existingById = new Map(story.chapters.map(chapter => [String(chapter._id), chapter]))
  const keptIds = req.body.chapters.filter(chapter => chapter.id).map(chapter => chapter.id)
  const originalKeptOrder = story.chapters.filter(chapter => keptIds.includes(String(chapter._id))).map(chapter => String(chapter._id))
  if (new Set(keptIds).size !== keptIds.length || keptIds.some(id => !existingById.has(id)) || keptIds.some((id, index) => id !== originalKeptOrder[index])) return res.status(400).json({ error: 'Existing chapters must keep their IDs and relative order.' })
  const firstNew = req.body.chapters.findIndex(chapter => !chapter.id)
  if (firstNew >= 0 && req.body.chapters.slice(firstNew).some(chapter => chapter.id)) return res.status(400).json({ error: 'New chapters must be added after existing chapters.' })
  for (const [index, chapter] of req.body.chapters.entries()) {
    for (const image of chapter.images) {
      if (!image.data && !existingById.get(chapter.id)?.images.some(existing => existing.publicId && existing.publicId === image.publicId)) return res.status(400).json({ error: 'An existing image does not belong to this chapter.' })
    }
  }
  if (req.body.thumbnail && !req.body.thumbnail.data && (!story.thumbnail?.publicId || req.body.thumbnail.publicId !== story.thumbnail.publicId)) return res.status(400).json({ error: 'That thumbnail does not belong to this story.' })
  const hasNewImages = !!req.body.thumbnail?.data || req.body.chapters.some(chapter => chapter.images.some(image => image.data))
  if (hasNewImages && !['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every(key => process.env[key]?.trim())) return res.status(503).json({ error: 'Cloudinary uploads are not configured.' })
  const uploaded = []
  let committed = false
  try {
    const thumbnail = req.body.thumbnail === undefined ? story.thumbnail : req.body.thumbnail === null ? null : req.body.thumbnail.data ? await uploadThumbnail(req.body.thumbnail, story.slug, uploaded) : story.thumbnail
    const chapters = []
    for (const [index, chapter] of req.body.chapters.entries()) {
      const images = []
      for (const image of chapter.images) {
        if (!image.data) {
          const original = existingById.get(chapter.id).images.find(item => item.publicId === image.publicId)
          images.push({ url: original.url, alt: original.alt, publicId: original.publicId, explanation: image.explanation === undefined ? (original.explanation || '') : image.explanation })
        } else {
          const asset = await cloudinary.uploader.upload(image.data, { folder: `storytelling/stories/${story.slug}`, resource_type: 'image', allowed_formats: ['png', 'jpg', 'jpeg', 'webp', 'gif'] })
          uploaded.push(asset.public_id)
          images.push({ url: asset.secure_url, publicId: asset.public_id, alt: '', explanation: image.explanation || '' })
        }
      }
      chapters.push({ title: chapter.title.trim(), text: chapter.text, images, number: index + 1 })
    }
    const fields = { plannedChapterCount: req.body.plannedChapterCount === undefined ? story.plannedChapterCount : req.body.plannedChapterCount, title: req.body.title.trim(), authorNote: req.body.authorNote || null, storytellerNote: '', description: chapters[0].text.slice(0, 180), thumbnail }
    const candidate = new Story({ ...story.toObject(), ...fields, chapters: chapters.map((chapter, index) => ({ ...(existingById.get(req.body.chapters[index].id)?.toObject() || {}), ...chapter })) })
    await candidate.validate()
    // Merge editor fields into the current database chapters, preserving comments posted while editing.
    const pipeline = [{ $set: {
      ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { $literal: value }])),
      __v: { $add: ['$__v', 1] },
      archivedChapters: { $concatArrays: [
        { $ifNull: ['$archivedChapters', []] },
        { $map: { input: { $filter: { input: '$chapters', as: 'old', cond: { $not: [{ $in: ['$$old._id', { $literal: candidate.chapters.map(chapter => chapter._id) }] }] } } }, as: 'removed', in: { $mergeObjects: ['$$removed', { deletedAt: { $literal: new Date() } }] } } },
      ] },
      chapters: { $map: {
        input: { $literal: candidate.chapters.map(chapter => ({ _id: chapter._id, number: chapter.number, title: chapter.title, text: chapter.text, images: chapter.images.map(image => image.toObject()) })) }, as: 'edited',
        in: { $mergeObjects: [
          { $ifNull: [{ $arrayElemAt: [{ $filter: { input: '$chapters', as: 'old', cond: { $eq: ['$$old._id', '$$edited._id'] } } }, 0] }, { comments: [], commentedUserIds: [] }] },
          '$$edited',
        ] },
      } },
    } }]
    const hasAddedChapters = req.body.chapters.some(chapter => !chapter.id)
    if (hasAddedChapters) await ensureChapterNotificationIndexes()
    let updated
    await mongoose.connection.transaction(async session => {
      updated = await Story.findOneAndUpdate({ _id: story._id, creatorId: req.user._id, deletedAt: null, __v: req.body.version }, pipeline, { new: true, updatePipeline: true, session })
      if (updated && hasAddedChapters) await notifyNewChapters(story.chapters.map(chapter => String(chapter._id)), updated, req.user, session)
    })
    if (!updated) {
      await Promise.allSettled(uploaded.map(id => cloudinary.uploader.destroy(id)))
      return res.status(409).json({ error: 'The story changed while saving. Reload the editor and try again.' })
    }
    committed = true
    return res.json(readerStory(updated, req.user))
  } catch {
    if (!committed) await Promise.allSettled(uploaded.map(id => cloudinary.uploader.destroy(id)))
    return res.status(500).json({ error: 'Unable to save changes. Your editor has been kept; please try again.' })
  }
}

export const softDeleteStory = async (req, res) => {
  try {
    const story = await Story.findOneAndUpdate({ _id: req.ownedStory._id, creatorId: req.user._id, deletedAt: null }, {
      $set: { deletedAt: new Date(), deletedBy: req.user._id },
      $inc: { __v: 1 },
    }, { new: true })
    if (!story) return res.status(404).json({ error: 'Story is no longer available.' })
    return res.json({ message: 'Story removed from the library. Its data has been retained.' })
  } catch { return res.status(500).json({ error: 'Unable to delete this story. Please try again.' }) }
}

const uploadThumbnail = async (image, slug, uploaded) => {
  const asset = await cloudinary.uploader.upload(image.data, { folder: `storytelling/stories/${slug}/thumbnail`, resource_type: 'image', allowed_formats: ['png', 'jpg', 'jpeg', 'webp', 'gif'] })
  uploaded.push(asset.public_id)
  return { url: asset.secure_url, publicId: asset.public_id, alt: typeof image.alt === 'string' ? image.alt.slice(0, 500) : '' }
}
