import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import mongoose from 'mongoose'
import Story from '../models/story.model.js'
import Notification from '../models/notification.model.js'
import cloudinary from './cloudinary.js'
import { cleanupStoryUploads, editorCharacters, prepareCharacterSheets, validateCharacterSheets } from './characterSheets.js'
import { createStory, getStoryEditor, listStories, readerStory, requireStoryOwner, updateStory, validateStoryInput } from '../controllers/story.controller.js'
import { loadCharacterSheets, serializeCharacterSheets } from '../../frontend/src/lib/editorCharacters.js'

const id = () => new mongoose.Types.ObjectId()
const ownerId = id(), imageData = 'data:image/png;base64,aGVsbG8='
const sheet = () => ({ name: 'Ayelen', notes: 'Private planned events involving Ayelen.', images: [] })
const fixture = () => new Story({ title: 'Story', slug: 'character-test', creatorId: ownerId, __v: 0,
  chapters: [{ number: 1, title: 'Opening', text: 'Public chapter text.', commentedUserIds: [ownerId] }], characters: [sheet()],
})
const bodyFor = story => ({ title: story.title, version: story.__v, chapters: story.chapters.map(chapter => ({ id: String(chapter._id), title: chapter.title, text: chapter.text, status: chapter.status, images: [] })) })
const resMock = () => ({ code: 200, status(code) { this.code = code; return this }, set() { return this }, json(data) { this.data = data; return this } })
let original
beforeEach(() => {
  original = { create: Story.create, find: Story.find, one: Story.findOne, update: Story.findOneAndUpdate, transaction: mongoose.connection.transaction,
    upload: cloudinary.uploader.upload, destroy: cloudinary.uploader.destroy, url: cloudinary.url, bulk: Notification.bulkWrite, env: { ...process.env } }
  for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) process.env[key] = 'offline-test'
})
afterEach(() => {
  Story.create = original.create; Story.find = original.find; Story.findOne = original.one; Story.findOneAndUpdate = original.update; mongoose.connection.transaction = original.transaction
  cloudinary.uploader.upload = original.upload; cloudinary.uploader.destroy = original.destroy; cloudinary.url = original.url; Notification.bulkWrite = original.bulk
  for (const key of Object.keys(process.env)) if (!(key in original.env)) delete process.env[key]
  Object.assign(process.env, original.env)
})

test('character model supports blank private notes, caps pictures, and excludes sheets from normal selection', async () => {
  assert.equal(Story.schema.path('characters').options.select, false)
  assert.equal(Story.schema.path('archivedCharacters').options.select, false)
  const story = fixture(); story.characters[0].name = ''; story.characters[0].notes = ''
  await story.validate()
  story.characters[0].images = Array.from({ length: 6 }, (_, index) => ({ url: `private-${index}`, publicId: `private-${index}` }))
  await assert.rejects(story.validate(), /five pictures/)
})

test('sheet validation accepts unfinished notes and rejects publishing, invalid lengths, or too many pictures', () => {
  assert.deepEqual(validateCharacterSheets([{ name: '', notes: '', images: [] }]), { bytes: 0 })
  for (const character of [{ ...sheet(), status: 'published' }, { ...sheet(), visibility: 'public' }, { ...sheet(), name: 'x'.repeat(201) }, { ...sheet(), notes: 'x'.repeat(100001) }, { ...sheet(), images: Array.from({ length: 6 }, () => ({ data: imageData })) }]) assert.ok(validateCharacterSheets([character]).error)
  assert.ok(validateCharacterSheets(Array.from({ length: 101 }, sheet)).error)
})

test('saved character IDs and picture references cannot be copied from other sheets or stories', () => {
  const story = fixture(), existing = story.characters[0]
  existing.images.push({ publicId: 'owned-private-photo', url: 'private' })
  const own = { ...sheet(), id: String(existing._id), images: [{ publicId: 'owned-private-photo' }] }
  assert.equal(validateCharacterSheets([own], story.characters, true).error, undefined)
  assert.ok(validateCharacterSheets([own, own], story.characters, true).error)
  assert.ok(validateCharacterSheets([{ ...own, id: String(id()) }], story.characters, true).error)
  assert.ok(validateCharacterSheets([{ ...own, images: [{ publicId: 'foreign-photo' }] }], story.characters, true).error)
  assert.ok(validateCharacterSheets([own], [], false).error)
})

test('story creation saves character sheets while returning no private character data', async () => {
  Story.create = async data => {
    assert.equal(data.characters[0].notes, sheet().notes)
    const story = new Story(data); await story.validate(); return story
  }
  const res = resMock()
  await createStory({ user: { _id: ownerId }, body: { title: 'Story', chapters: [{ status: 'draft', title: '', text: '', images: [] }], characters: [sheet()] } }, res)
  assert.equal(res.code, 201)
  assert.equal(Object.hasOwn(res.data, 'characters'), false)
  assert.equal(JSON.stringify(res.data).includes(sheet().notes), false)
})

test('protected editor returns character sheets and signed authenticated picture URLs', () => {
  const story = fixture()
  story.characters[0].images.push({ publicId: 'private-photo', url: 'unsigned-private-url', format: 'png', version: 123 })
  cloudinary.url = (publicId, options) => {
    assert.equal(publicId, 'private-photo')
    assert.equal(options.type, 'authenticated'); assert.equal(options.sign_url, true); assert.equal(options.secure, true)
    assert.equal(options.format, 'png'); assert.equal(options.version, 123)
    return 'https://signed.example/private-photo'
  }
  const res = resMock(); getStoryEditor({ ownedStory: story }, res)
  assert.equal(res.data.characters[0].notes, sheet().notes)
  assert.equal(res.data.characters[0].images[0].url, 'https://signed.example/private-photo')
  assert.equal(res.data.characters[0].id, String(story.characters[0]._id))
})

test('reader and library responses omit all character content even when supplied a fully loaded document', async () => {
  const story = fixture()
  for (const user of [null, { _id: ownerId }, { _id: id(), role: 'admin' }]) {
    const view = readerStory(story, user)
    assert.equal(Object.hasOwn(view, 'characters'), false)
    assert.equal(JSON.stringify(view).includes(sheet().notes), false)
    assert.equal(view.availableChapterCount, 1)
  }
  Story.find = () => ({ select() { return this }, sort() { return this }, lean: async () => [story.toObject()] })
  const res = resMock(); await listStories({}, res)
  assert.equal(JSON.stringify(res.data).includes(sheet().notes), false)
})

test('only the creator can pass the character editor ownership guard, including when another admin asks', async () => {
  const story = fixture()
  Story.findOne = async (_filter, projection) => { assert.equal(projection, '+characters'); return story }
  let allowed = false
  await requireStoryOwner({ params: { slug: story.slug }, user: { _id: ownerId } }, resMock(), () => { allowed = true })
  assert.equal(allowed, true)
  for (const role of ['reader', 'writer', 'admin']) {
    const res = resMock()
    await requireStoryOwner({ params: { slug: story.slug }, user: { _id: id(), role } }, res, () => assert.fail('not creator'))
    assert.equal(res.code, 403)
  }
})

test('character changes save atomically with the story and keep chapter IDs, comments and unlock markers', async () => {
  const story = fixture(), body = bodyFor(story), characterId = String(story.characters[0]._id)
  body.characters = [{ ...sheet(), id: characterId, notes: 'Updated private plans.' }, { name: 'Yarasy', notes: 'A future conversation.', images: [] }]
  mongoose.connection.transaction = async callback => callback({})
  Notification.bulkWrite = () => assert.fail('character notes must not send chapter notifications')
  Story.findOneAndUpdate = async (filter, pipeline) => {
    assert.equal(filter.creatorId, ownerId); assert.equal(filter.__v, 0)
    const characters = pipeline[0].$set.characters.$literal
    assert.equal(String(characters[0]._id), characterId)
    assert.equal(characters[0].notes, 'Updated private plans.')
    assert.equal(characters[1].name, 'Yarasy')
    assert.notEqual(String(characters[1]._id), characterId)
    assert.ok(pipeline[0].$set.chapters.$map.in.$mergeObjects)
    assert.equal(String(pipeline[0].$set.chapters.$map.input.$literal[0]._id), String(story.chapters[0]._id))
    return new Story({ ...story.toObject(), characters })
  }
  const res = resMock(); await updateStory({ ownedStory: story, user: { _id: ownerId }, body }, res)
  assert.equal(res.code, 200)
  assert.equal(res.data.availableChapterCount, 1)
  assert.equal(Object.hasOwn(res.data, 'characters'), false)
})

test('older save requests without characters preserve existing sheets and their archives', async () => {
  const story = fixture()
  mongoose.connection.transaction = async callback => callback({})
  Story.findOneAndUpdate = async (_filter, pipeline) => {
    assert.equal(Object.hasOwn(pipeline[0].$set, 'characters'), false)
    assert.equal(Object.hasOwn(pipeline[0].$set, 'archivedCharacters'), false)
    return story
  }
  const res = resMock(); await updateStory({ ownedStory: story, user: { _id: ownerId }, body: bodyFor(story) }, res)
  assert.equal(res.code, 200)
})

test('removing sheets archives them without destroying their stored pictures', async () => {
  const story = fixture(), body = { ...bodyFor(story), characters: [] }
  cloudinary.uploader.destroy = () => assert.fail('archived assets must not be destroyed')
  mongoose.connection.transaction = async callback => callback({})
  Story.findOneAndUpdate = async (_filter, pipeline) => {
    assert.deepEqual(pipeline[0].$set.characters.$literal, [])
    const archive = pipeline[0].$set.archivedCharacters.$concatArrays
    assert.deepEqual(archive[0], { $ifNull: ['$archivedCharacters', []] })
    assert.deepEqual(archive[1].$map.input.$filter.cond.$not[0].$in[1], { $literal: [] })
    assert.ok(archive[1].$map.in.$mergeObjects[1].deletedAt.$literal instanceof Date)
    return story
  }
  const res = resMock(); await updateStory({ ownedStory: story, user: { _id: ownerId }, body }, res)
  assert.equal(res.code, 200)
})

test('character pictures upload as authenticated assets and retain current metadata when reused', async () => {
  const uploads = []
  cloudinary.uploader.upload = async (data, options) => {
    assert.equal(data, imageData); assert.equal(options.type, 'authenticated'); assert.equal(options.resource_type, 'image')
    return { public_id: 'new-private-photo', secure_url: 'private-url', format: 'png', version: 456 }
  }
  const prepared = await prepareCharacterSheets([{ ...sheet(), images: [{ data: imageData }] }], [], 'story', uploads)
  assert.equal(prepared[0].images[0].publicId, 'new-private-photo')
  assert.deepEqual(uploads, [{ publicId: 'new-private-photo', type: 'authenticated' }])
  const createdAt = prepared[0].createdAt
  const reused = await prepareCharacterSheets([{ ...sheet(), id: String(prepared[0]._id), images: [{ publicId: 'new-private-photo', url: 'attacker-url', explanation: 'Updated private caption' }] }], prepared, 'story', [])
  assert.equal(reused[0].images[0].url, 'private-url')
  assert.equal(reused[0].images[0].explanation, 'Updated private caption')
  assert.equal(reused[0].createdAt, createdAt)
})

test('failed-save cleanup uses the correct asset delivery type', async () => {
  const destroyed = []
  cloudinary.uploader.destroy = async (...args) => { destroyed.push(args) }
  await cleanupStoryUploads(['public-chapter-photo', { publicId: 'private-character-photo', type: 'authenticated' }])
  assert.deepEqual(destroyed, [['public-chapter-photo'], ['private-character-photo', { type: 'authenticated', resource_type: 'image' }]])
})

test('picture byte limits include character photos in the shared save budget', () => {
  const image = `data:image/png;base64,${Buffer.alloc(5 * 1024 * 1024).toString('base64')}`
  const body = { title: 'Story', chapters: [{ status: 'draft', title: '', text: '', images: [{ data: image }] }], characters: [{ ...sheet(), images: Array.from({ length: 5 }, () => ({ data: image })) }] }
  assert.match(validateStoryInput(body), /25 MB/)
})

test('frontend reload/serialization preserves saved IDs and never treats a private remote URL as a new upload', async () => {
  const sheets = loadCharacterSheets([{ id: 'saved-character', name: 'Ayelen', notes: 'Private plans', images: [{ publicId: 'private-picture', url: 'signed-private-url' }] }])
  assert.equal(sheets[0].characterId, 'saved-character')
  const serialized = await serializeCharacterSheets([...sheets, { id: 'local-only', name: '', notes: '', images: [{ id: 'local-picture', file: 'local-file' }] }], async file => { assert.equal(file, 'local-file'); return imageData })
  assert.equal(serialized[0].id, 'saved-character')
  assert.deepEqual(serialized[0].images, [{ publicId: 'private-picture', explanation: '' }])
  assert.equal(Object.hasOwn(serialized[1], 'id'), false)
  assert.equal(serialized[1].images[0].data, imageData)
})

test('stale versions cannot overwrite private character work in another editor tab', async () => {
  const story = fixture(), body = { ...bodyFor(story), version: -1, characters: [{ ...sheet(), id: String(story.characters[0]._id) }] }
  Story.findOneAndUpdate = () => assert.fail('must not overwrite current sheets')
  const res = resMock(); await updateStory({ ownedStory: story, user: { _id: ownerId }, body }, res)
  assert.equal(res.code, 409)
})


test('the installed Cloudinary SDK generates signed authenticated URLs for character pictures', () => {
  const config = { ...cloudinary.config() }
  try {
    cloudinary.config({ cloud_name: 'offline-test', api_key: 'offline-key', api_secret: 'offline-secret' })
    const story = fixture()
    story.characters[0].images.push({ publicId: 'private-photo', url: 'unsigned', format: 'png', version: 123 })
    const url = editorCharacters(story)[0].images[0].url
    assert.match(new URL(url).pathname, /\/image\/authenticated\/s--[^/]+--\/v123\/private-photo\.png$/)
    assert.equal(url.includes('offline-secret'), false)
  } finally { cloudinary.config(config) }
})
