import mongoose from 'mongoose'
import ReadingProgress from '../models/readingProgress.model.js'
import { loadStory } from '../lib/storyRepository.js'
import { canReadChapter } from '../lib/storyAccess.js'

export const saveReadingProgress = async (req, res) => {
  const { chapterId, paragraphIndex = 0 } = req.body || {}
  if (typeof chapterId !== 'string' || !mongoose.isValidObjectId(chapterId)) return res.status(400).json({ error: 'Invalid chapter ID.' })
  if (!Number.isInteger(paragraphIndex) || paragraphIndex < 0) return res.status(400).json({ error: 'Invalid paragraph index.' })
  try {
    const story = await loadStory(req.params.slug)
    if (!story) return res.status(404).json({ error: 'Story not found.' })
    const index = story.chapters.findIndex(chapter => String(chapter._id) === chapterId)
    if (index < 0) return res.status(404).json({ error: 'Chapter not found.' })
    if (!canReadChapter(story, index, req.user)) return res.status(403).json({ error: 'This chapter is not unlocked yet.' })
    const paragraphs = story.chapters[index].text.split(/\n\s*\n/u).filter(text => text.trim())
    if (paragraphIndex >= Math.max(1, paragraphs.length)) return res.status(400).json({ error: 'Paragraph not found.' })
    const scope = { userId: req.user._id, storyId: story._id }
    const update = { $set: { chapterId, paragraphIndex, lastReadAt: new Date() } }
    try { await ReadingProgress.updateOne(scope, update, { upsert: true, runValidators: true }) }
    catch (error) { if (error.code !== 11000) throw error; await ReadingProgress.updateOne(scope, update, { runValidators: true }) }
    return res.json({ chapterId })
  } catch { return res.status(500).json({ error: 'Unable to save your reading position.' }) }
}

export const resumeChapterId = (story, user, progress) => {
  if (!user || !progress) return null
  const index = story.chapters.findIndex(chapter => String(chapter._id) === String(progress.chapterId))
  return index >= 0 && canReadChapter(story, index, user) ? String(story.chapters[index]._id) : null
}
