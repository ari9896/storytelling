import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import mongoose from 'mongoose'
import Story from '../models/story.model.js'
import Comment from '../models/comment.model.js'
import Notification from '../models/notification.model.js'
import ReadingProgress from '../models/readingProgress.model.js'
import { createStory, getStory, getStoryEditor, listDraftStories, listStories, readerStory, requireStoryOwner, updateStory, validateStoryInput } from '../controllers/story.controller.js'
import { getDiscussion, postComment } from '../controllers/comment.controller.js'
import { setCommentReaction, getReactionUsers } from '../controllers/commentReaction.controller.js'
import { saveReadingProgress, resumeChapterId } from '../controllers/readingProgress.controller.js'
import { searchInvitees, sendStoryInvitation } from '../controllers/storyInvitation.controller.js'
import { listNotifications } from '../controllers/notification.controller.js'
import { notifyNewChapters } from './chapterNotifications.js'
import { canReadChapter } from './storyAccess.js'
import { publishedChapters } from './chapterPublication.js'

const id = () => new mongoose.Types.ObjectId()
const ownerId = id(), readerId = id()
const resMock = () => ({ code: 200, status(code) { this.code = code; return this }, set() { return this }, json(data) { this.data = data; return this } })
const storyFixture = () => new Story({ title: 'Draft testing', slug: 'draft-testing', creatorId: ownerId, __v: 0, chapters: [
  { title: 'Public opening', text: 'Public opening text.', number: 1, commentedUserIds: [readerId] },
  { status: 'draft', title: 'Secret draft title', text: 'Secret unfinished ideas.', number: 2, images: [{ url: 'https://example.com/private-draft-image', explanation: 'Private explanation' }] },
] })
const bodyFor = story => ({ title: story.title, version: story.__v, chapters: story.chapters.map(chapter => ({ id: String(chapter._id), status: chapter.status, title: chapter.title, text: chapter.text, images: [] })) })
let originals
beforeEach(() => {
  originals = { storyCreate: Story.create, storyFind: Story.find, storyOne: Story.findOne, storyUpdate: Story.findOneAndUpdate,
    commentFind: Comment.find, commentUpdate: Comment.findOneAndUpdate, progressUpdate: ReadingProgress.updateOne,
    transaction: mongoose.connection.transaction, indexes: Notification.createIndexes, drop: Notification.collection.dropIndex, bulk: Notification.bulkWrite, aggregate: Notification.aggregate }
  Notification.createIndexes = async () => []
  Notification.collection.dropIndex = async () => {}
})
afterEach(() => {
  Story.create = originals.storyCreate; Story.find = originals.storyFind; Story.findOne = originals.storyOne; Story.findOneAndUpdate = originals.storyUpdate
  Comment.find = originals.commentFind; Comment.findOneAndUpdate = originals.commentUpdate; ReadingProgress.updateOne = originals.progressUpdate
  mongoose.connection.transaction = originals.transaction; Notification.createIndexes = originals.indexes; Notification.collection.dropIndex = originals.drop; Notification.bulkWrite = originals.bulk; Notification.aggregate = originals.aggregate
})

test('legacy chapter documents remain published while draft schema allows incomplete work', async () => {
  const story = storyFixture()
  assert.equal(story.chapters[0].status, 'published')
  story.chapters[1].title = ''; story.chapters[1].text = ''
  await story.validate()
  story.chapters[1].status = 'published'
  await assert.rejects(story.validate(), /required/)
})

test('draft validation accepts blank text but published chapters must be complete and in order', () => {
  const body = { title: 'Ideas', chapters: [{ status: 'draft', title: '', text: '', images: [] }] }
  assert.equal(validateStoryInput(body), null)
  body.chapters[0].status = 'published'
  assert.match(validateStoryInput(body), /Published chapters need/)
  body.chapters[0].status = 'draft'
  body.chapters.push({ status: 'published', title: 'Later chapter', text: 'Ready text', images: [] })
  assert.match(validateStoryInput(body), /in order/)
  body.chapters[1].status = 'private'
  assert.match(validateStoryInput(body), /Draft or Published/)
})

test('saving a new story defaults chapters to private and stores no draft text in its description', async () => {
  for (const status of ['draft', undefined]) {
    const chapter = { title: '', text: 'Unfinished private ideas.', images: [], ...(status ? { status } : {}) }
    Story.create = async data => {
      assert.equal(data.chapters[0].status, 'draft')
      assert.equal(data.description, '')
      const saved = new Story(data); await saved.validate(); return saved
    }
    const res = resMock()
    await createStory({ body: { title: 'Private project', chapters: [chapter] }, user: { _id: ownerId } }, res)
    assert.equal(res.code, 201)
    assert.equal(res.data.availableChapterCount, 0)
    assert.deepEqual(res.data.slides, [])
    assert.equal(JSON.stringify(res.data).includes('Unfinished private ideas'), false)
  }
})

test('reader projections omit draft IDs, titles, text, images and explanations, including for admins and authors', () => {
  const story = storyFixture()
  for (const user of [null, { _id: readerId }, { _id: ownerId }, { _id: id(), role: 'admin' }]) {
    const view = readerStory(story, user)
    assert.equal(view.availableChapterCount, 1)
    assert.equal(view.slides.length, 1)
    assert.equal(view.slides[0].title, 'Public opening')
    const json = JSON.stringify(view)
    for (const secret of ['Secret draft title', 'Secret unfinished ideas', 'private-draft-image', 'Private explanation', String(story.chapters[1]._id)]) assert.equal(json.includes(secret), false)
  }
})

test('direct reader requests cannot open stories with only drafts', async () => {
  const story = storyFixture(); story.chapters[0].status = 'draft'
  Story.findOne = async () => story
  const res = resMock(); await getStory({ params: { slug: story.slug } }, res)
  assert.equal(res.code, 404)
})

test('protected editor returns drafts, including status and unfinished text', () => {
  const story = storyFixture(), res = resMock()
  getStoryEditor({ ownedStory: story }, res)
  assert.equal(res.data.chapters.length, 2)
  assert.equal(res.data.chapters[0].status, 'published')
  assert.equal(res.data.chapters[1].status, 'draft')
  assert.equal(res.data.chapters[1].text, 'Secret unfinished ideas.')
})

test('other readers and admins cannot bypass ownership to access the draft editor', async () => {
  const story = storyFixture(); Story.findOne = async () => story
  for (const role of ['reader', 'writer', 'admin']) {
    const res = resMock()
    await requireStoryOwner({ params: { slug: story.slug }, user: { _id: id(), role } }, res, () => assert.fail('not owner'))
    assert.equal(res.code, 403)
  }
})

test('library query requires a published or legacy chapter', async () => {
  Story.find = filter => {
    assert.deepEqual(filter.chapters, { $elemMatch: { status: { $ne: 'draft' } } })
    return { select() { return this }, sort() { return this }, lean: async () => [] }
  }
  const res = resMock(); await listStories({}, res)
  assert.deepEqual(res.data, [])
})

test('private draft listing is scoped to the current creator and exposes only summary data', async () => {
  const story = storyFixture()
  Story.find = filter => {
    assert.equal(filter.creatorId, ownerId)
    assert.equal(filter['chapters.status'], 'draft')
    assert.equal(filter.deletedAt, null)
    return { select() { return this }, sort() { return this }, lean: async () => [story.toObject()] }
  }
  const res = resMock(); await listDraftStories({ user: { _id: ownerId } }, res)
  assert.deepEqual(res.data, [{ id: story.slug, title: story.title, draftChapterCount: 1, publishedChapterCount: 1 }])
})

test('drafts never satisfy read access, bookmark restoration, or chapter progression', () => {
  const story = storyFixture()
  for (const user of [{ _id: readerId }, { _id: ownerId }, { _id: id(), role: 'admin' }]) {
    assert.equal(canReadChapter(story, 1, user), false)
    assert.equal(resumeChapterId(story, user, { chapterId: story.chapters[1]._id }), null)
  }
  assert.equal(canReadChapter(story, 0, null), true)
})

test('discussion responses hide draft metadata and query comments only from published chapters', async () => {
  const story = storyFixture(); Story.findOne = async () => story
  Comment.find = filter => {
    assert.deepEqual(filter.chapterId.$in.map(String), [String(story.chapters[0]._id)])
    return { sort() { return this }, populate() { return this }, lean: async () => [] }
  }
  const res = resMock(); await getDiscussion({ params: { slug: story.slug } }, res)
  assert.equal(res.code, 200)
  assert.equal(res.data.chapters.length, 1)
  assert.equal(JSON.stringify(res.data).includes(String(story.chapters[1]._id)), false)
})

test('comments, reactions, reaction identities, and bookmarks cannot target draft chapters', async () => {
  const story = storyFixture(); Story.findOne = async () => story
  mongoose.connection.transaction = () => assert.fail('must not write')
  Comment.findOneAndUpdate = () => assert.fail('must not react')
  ReadingProgress.updateOne = () => assert.fail('must not save position')
  for (const handler of [postComment, setCommentReaction, getReactionUsers, saveReadingProgress]) {
    const res = resMock()
    await handler({ params: { slug: story.slug, chapterId: String(story.chapters[1]._id), commentId: String(id()) }, user: { _id: ownerId },
      query: { emoji: '🔥' }, body: { body: 'I wonder how this character will handle the next challenge.', emoji: '🔥', chapterId: String(story.chapters[1]._id), paragraphIndex: 0 } }, res)
    assert.equal(res.code, 403)
  }
})

const setupSave = (story, expectedStatuses) => {
  mongoose.connection.transaction = async callback => callback({})
  Story.findOneAndUpdate = async (_filter, pipeline) => {
    const chapters = pipeline[0].$set.chapters.$map.input.$literal
    assert.deepEqual(chapters.map(chapter => chapter.status), expectedStatuses)
    assert.ok(pipeline[0].$set.chapters.$map.in.$mergeObjects)
    const fields = Object.fromEntries(Object.entries(pipeline[0].$set).filter(([, value]) => value.$literal !== undefined).map(([key, value]) => [key, value.$literal]))
    return new Story({ ...story.toObject(), ...fields, chapters: chapters.map(chapter => ({ ...story.chapters.id(chapter._id)?.toObject(), ...chapter })) })
  }
}

test('saving appended incomplete drafts preserves published status, IDs and progress without notifications', async () => {
  const story = storyFixture()
  const body = bodyFor(story)
  delete body.chapters[0].status
  body.chapters[1].title = ''; body.chapters[1].text = ''
  body.chapters.push({ title: '', text: '', images: [] })
  setupSave(story, ['published', 'draft', 'draft'])
  Notification.bulkWrite = () => assert.fail('drafts must not notify')
  const res = resMock(); await updateStory({ ownedStory: story, user: { _id: ownerId }, body }, res)
  assert.equal(res.code, 200)
  assert.equal(res.data.availableChapterCount, 1)
  assert.equal(res.data.slides.length, 1)
})

test('publishing an existing saved draft notifies readers even though its ID already existed', async () => {
  const story = storyFixture(), body = bodyFor(story)
  body.chapters[1].status = 'published'
  setupSave(story, ['published', 'published'])
  let operations = []
  Notification.bulkWrite = async records => { operations = records }
  const res = resMock(); await updateStory({ ownedStory: story, user: { _id: ownerId }, body }, res)
  assert.equal(res.code, 200)
  assert.equal(res.data.availableChapterCount, 2)
  assert.equal(operations.length, 1)
  assert.equal(String(operations[0].updateOne.filter.chapterId), String(story.chapters[1]._id))
  assert.equal(String(operations[0].updateOne.filter.recipient), String(readerId))
  assert.equal(operations[0].updateOne.upsert, true)
})

test('draft chapters do not generate new-chapter notifications', async () => {
  const story = storyFixture()
  Notification.bulkWrite = () => assert.fail('draft must not notify')
  await notifyNewChapters([String(story.chapters[0]._id)], story, { _id: ownerId }, {})
  assert.equal(publishedChapters(story).length, 1)
})

test('draft-only stories cannot be searched for invitees or sent as invitations', async () => {
  const story = storyFixture(); story.chapters[0].status = 'draft'
  for (const handler of [searchInvitees, sendStoryInvitation]) {
    const res = resMock()
    await handler({ user: { _id: ownerId }, ownedStory: story, query: { q: 'Re' }, body: { username: 'Reader' } }, res)
    assert.equal(res.code, 400)
    assert.match(res.data.error, /Publish the first chapter/)
  }
})

test('notifications exclude private stories and unpublished chapter targets', async () => {
  Notification.aggregate = async pipeline => {
    assert.ok(pipeline.some(stage => stage.$match?.['story.chapters']?.$elemMatch?.status?.$ne === 'draft'))
    assert.ok(pipeline.some(stage => stage.$match?.$or?.some(condition => condition['chapter.status']?.$ne === 'draft')))
    return [{ items: [], unread: [] }]
  }
  const res = resMock(); await listNotifications({ user: { _id: readerId } }, res)
  assert.deepEqual(res.data, { items: [], unreadCount: 0 })
})
