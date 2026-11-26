import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import mongoose from 'mongoose'
import Story from '../models/story.model.js'
import Notification from '../models/notification.model.js'
import { updateStory } from '../controllers/story.controller.js'
import { resumeChapterId } from '../controllers/readingProgress.controller.js'
import { moveChapter, hasDraftBeforePublished } from '../../frontend/src/lib/chapterOrder.js'

const id = () => new mongoose.Types.ObjectId()
const ownerId = id(), readerId = id()
const fixture = () => new Story({ title: 'Reorder test', slug: 'reorder-test', creatorId: ownerId, __v: 0,
  chapters: Array.from({ length: 5 }, (_, index) => ({ number: index + 1, status: 'published', title: `Title ${index + 1}`, text: `Text ${index + 1}`,
    images: [{ url: `https://example.com/${index + 1}.jpg`, publicId: `image-${index + 1}`, alt: `Image ${index + 1}`, explanation: `Explanation ${index + 1}` }],
    commentedUserIds: [readerId], comments: [{ author: readerId, authorName: 'Reader', body: `Comment on ${index + 1}` }],
  })),
})
const bodyFor = chapters => ({ title: 'Reorder test', version: 0, chapters: chapters.map(chapter => ({ id: String(chapter._id), status: chapter.status, title: chapter.title, text: chapter.text,
  images: chapter.images.map(image => ({ publicId: image.publicId, explanation: image.explanation })),
})) })
const resMock = () => ({ code: 200, status(code) { this.code = code; return this }, json(data) { this.data = data; return this } })
let original
beforeEach(() => {
  original = { update: Story.findOneAndUpdate, transaction: mongoose.connection.transaction, indexes: Notification.createIndexes, drop: Notification.collection.dropIndex, bulk: Notification.bulkWrite }
  mongoose.connection.transaction = async callback => callback({})
  Notification.createIndexes = async () => []
  Notification.collection.dropIndex = async () => {}
})
afterEach(() => { Story.findOneAndUpdate = original.update; mongoose.connection.transaction = original.transaction; Notification.createIndexes = original.indexes; Notification.collection.dropIndex = original.drop; Notification.bulkWrite = original.bulk })

const applyEditedFields = (story, pipeline) => {
  const edited = pipeline[0].$set.chapters.$map.input.$literal
  const fields = Object.fromEntries(Object.entries(pipeline[0].$set).filter(([, value]) => value.$literal !== undefined).map(([key, value]) => [key, value.$literal]))
  return new Story({ ...story.toObject(), ...fields, chapters: edited.map(chapter => ({ ...story.chapters.id(chapter._id)?.toObject(), ...chapter })) })
}

test('moving chapter five to the beginning retains the exact chapter objects and all their contents', () => {
  const chapters = Array.from({ length: 5 }, (_, index) => ({ id: String(index + 1), title: `Title ${index + 1}`, text: `Text ${index + 1}`, images: [{ url: `image-${index + 1}` }], status: 'published' }))
  const reordered = moveChapter(chapters, '5', '1')
  assert.deepEqual(reordered.map(chapter => chapter.id), ['5', '1', '2', '3', '4'])
  assert.equal(reordered[0], chapters[4])
  assert.deepEqual(chapters.map(chapter => chapter.id), ['1', '2', '3', '4', '5'])
  assert.equal(moveChapter(chapters, 'missing', '1'), chapters)
  assert.equal(moveChapter(chapters, '1', '1'), chapters)
  assert.deepEqual(moveChapter(chapters, '1', '5').map(chapter => chapter.id), ['2', '3', '4', '5', '1'])
})

test('draft reordering never changes visibility and warns when a draft precedes published content', () => {
  const chapters = [{ id: '1', status: 'published' }, { id: '2', status: 'draft' }, { id: '3', status: 'draft' }]
  const valid = moveChapter(chapters, '3', '2')
  assert.equal(hasDraftBeforePublished(valid), false)
  assert.equal(valid[1].status, 'draft')
  const invalid = moveChapter(chapters, '3', '1')
  assert.equal(invalid[0].status, 'draft')
  assert.equal(hasDraftBeforePublished(invalid), true)
})

test('saving chapter five first renumbers chapters while preserving IDs, images, comments and concurrent reading markers', async () => {
  const story = fixture()
  const order = [story.chapters[4], ...story.chapters.slice(0, 4)]
  const originalIds = story.chapters.map(chapter => String(chapter._id))
  const expectedIds = order.map(chapter => String(chapter._id))
  const concurrentReader = id()
  let saved
  Notification.bulkWrite = () => assert.fail('reorder must not notify as a new chapter')
  Story.findOneAndUpdate = async (filter, pipeline) => {
    assert.equal(filter.creatorId, ownerId)
    assert.equal(filter.__v, 0)
    const edited = pipeline[0].$set.chapters.$map.input.$literal
    assert.deepEqual(edited.map(chapter => String(chapter._id)), expectedIds)
    assert.deepEqual(edited.map(chapter => chapter.number), [1, 2, 3, 4, 5])
    for (const chapter of edited) { assert.equal(Object.hasOwn(chapter, 'comments'), false); assert.equal(Object.hasOwn(chapter, 'commentedUserIds'), false) }
    assert.ok(pipeline[0].$set.chapters.$map.in.$mergeObjects)
    // Simulate a comment arriving after the editor was loaded: the database merge uses current state.
    story.chapters[0].commentedUserIds.push(concurrentReader)
    saved = applyEditedFields(story, pipeline)
    await saved.validate()
    return saved
  }
  const res = resMock(); await updateStory({ ownedStory: story, user: { _id: ownerId }, body: bodyFor(order) }, res)
  assert.equal(res.code, 200)
  assert.deepEqual(saved.chapters.map(chapter => String(chapter._id)), expectedIds)
  assert.deepEqual(new Set(saved.chapters.map(chapter => String(chapter._id))), new Set(originalIds))
  assert.equal(saved.chapters[0].title, 'Title 5')
  assert.equal(saved.chapters[0].text, 'Text 5')
  assert.equal(saved.chapters[0].images[0].url, 'https://example.com/5.jpg')
  assert.equal(saved.chapters[0].images[0].explanation, 'Explanation 5')
  assert.equal(saved.chapters[0].comments[0].body, 'Comment on 5')
  assert.ok(saved.chapters.id(originalIds[0]).commentedUserIds.some(value => String(value) === String(concurrentReader)))
  assert.equal(res.data.slides[0].chapter, 1)
  assert.equal(res.data.slides[0].chapterId, originalIds[4])
  assert.equal(res.data.description, 'Text 5')
})

test('a saved chapter bookmark still identifies the same content after renumbering', () => {
  const story = fixture(), chapterId = String(story.chapters[4]._id)
  const chapters = [story.chapters[4].toObject(), ...story.chapters.slice(0, 4).map(chapter => chapter.toObject())].map((chapter, index) => ({ ...chapter, number: index + 1 }))
  const reordered = new Story({ ...story.toObject(), chapters })
  assert.equal(resumeChapterId(reordered, { _id: ownerId }, { chapterId, paragraphIndex: 2 }), chapterId)
  assert.equal(resumeChapterId(reordered, { _id: readerId }, { chapterId, paragraphIndex: 2 }), chapterId)
  assert.equal(reordered.chapters.id(chapterId).text, 'Text 5')
})

test('new published chapters can be inserted between existing chapters without changing existing IDs', async () => {
  const story = fixture(), body = bodyFor(story.chapters)
  body.chapters.splice(2, 0, { status: 'published', title: 'Inserted chapter', text: 'Inserted text', images: [] })
  let saved, notifications = []
  Story.findOneAndUpdate = async (_filter, pipeline) => { saved = applyEditedFields(story, pipeline); await saved.validate(); return saved }
  Notification.bulkWrite = async operations => { notifications = operations }
  const res = resMock(); await updateStory({ ownedStory: story, user: { _id: ownerId }, body }, res)
  assert.equal(res.code, 200)
  assert.equal(saved.chapters.length, 6)
  assert.equal(saved.chapters[2].title, 'Inserted chapter')
  assert.deepEqual(saved.chapters.map(chapter => chapter.number), [1, 2, 3, 4, 5, 6])
  for (const chapter of story.chapters) assert.ok(saved.chapters.id(chapter._id))
  assert.equal(notifications.length, 1)
  assert.equal(String(notifications[0].updateOne.filter.chapterId), String(saved.chapters[2]._id))
})

test('reordered requests still reject duplicated or foreign chapter IDs', async () => {
  Story.findOneAndUpdate = () => assert.fail('must not write')
  for (const duplicate of [true, false]) {
    const story = fixture(), body = bodyFor(story.chapters)
    body.chapters[4].id = duplicate ? body.chapters[0].id : String(id())
    const res = resMock(); await updateStory({ ownedStory: story, user: { _id: ownerId }, body }, res)
    assert.equal(res.code, 400)
    assert.match(res.data.error, /original ID/)
  }
})

test('a draft cannot silently become public by being moved before a published chapter', async () => {
  const story = fixture()
  story.chapters[4].status = 'draft'
  const body = bodyFor([story.chapters[4], ...story.chapters.slice(0, 4)])
  Story.findOneAndUpdate = () => assert.fail('must not write invalid publication order')
  const res = resMock(); await updateStory({ ownedStory: story, user: { _id: ownerId }, body }, res)
  assert.equal(res.code, 400)
  assert.match(res.data.error, /in order/)
})

test('concurrent story-version changes still prevent an obsolete reorder from overwriting newer work', async () => {
  const story = fixture(), body = bodyFor([...story.chapters].reverse()); body.version = -1
  Story.findOneAndUpdate = () => assert.fail('must not write obsolete version')
  const res = resMock(); await updateStory({ ownedStory: story, user: { _id: ownerId }, body }, res)
  assert.equal(res.code, 409)
})
