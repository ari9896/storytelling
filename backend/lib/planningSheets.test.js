import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import mongoose from 'mongoose'
import Story from '../models/story.model.js'
import Notification from '../models/notification.model.js'
import { createStory, getStoryEditor, listStories, readerStory, requireStoryOwner, updateStory, validateStoryInput } from '../controllers/story.controller.js'
import { editorPlanningSheets, preparePlanningSheets, validatePlanningSheets } from './planningSheets.js'
import { loadPlanningSheets, restorePlanningSelection, serializePlanningSheets } from '../../frontend/src/lib/editorPlanning.js'

const id = () => new mongoose.Types.ObjectId()
const ownerId = id(), readerId = id()
const fixture = () => new Story({ title: 'Story', slug: 'planning-test', creatorId: ownerId, __v: 0,
  chapters: [{ number: 1, title: 'Public chapter', text: 'Public story text.', commentedUserIds: [readerId] }],
  characters: [{ name: 'Ayelen', notes: 'Private character notes.', images: [] }],
  events: [{ title: 'Private future event', text: 'Private event text.' }], threads: [{ title: 'Private ongoing thread', text: 'Private thread text.' }],
})
const bodyFor = story => ({ title: story.title, version: story.__v, chapters: story.chapters.map(chapter => ({ id: String(chapter._id), title: chapter.title, text: chapter.text, status: chapter.status, images: [] })) })
const resMock = () => ({ code: 200, set() { return this }, status(code) { this.code = code; return this }, json(data) { this.data = data; return this } })
let original
beforeEach(() => { original = { create: Story.create, one: Story.findOne, find: Story.find, update: Story.findOneAndUpdate, transaction: mongoose.connection.transaction, notify: Notification.bulkWrite } })
afterEach(() => { Story.create = original.create; Story.findOne = original.one; Story.find = original.find; Story.findOneAndUpdate = original.update; mongoose.connection.transaction = original.transaction; Notification.bulkWrite = original.notify })

test('events and threads are private text-only subdocuments supporting empty ideas', async () => {
  for (const field of ['events', 'threads', 'archivedEvents', 'archivedThreads']) assert.equal(Story.schema.path(field).options.select, false)
  const story = fixture()
  story.events.push({ title: '', text: '' }); story.threads.push({ title: '', text: '' })
  await story.validate()
  assert.equal(Object.hasOwn(story.events[0].toObject(), 'images'), false)
  assert.equal(Object.hasOwn(story.threads[0].toObject(), 'status'), false)
})

test('planning validation enforces text limits, private-only status, and no picture fields', () => {
  assert.equal(validatePlanningSheets([{ title: '', text: '' }]), null)
  for (const sheet of [{ title: 'x'.repeat(201), text: '' }, { title: '', text: 'x'.repeat(100001) }, { title: '', text: '', status: 'published' }, { title: '', text: '', visibility: 'public' }, { title: '', text: '', images: [] }]) assert.ok(validatePlanningSheets([sheet]))
  assert.ok(validatePlanningSheets(Array.from({ length: 101 }, () => ({ title: '', text: '' }))))
})

test('sheet identity is scoped to the original story and category, with no duplicate IDs', () => {
  const story = fixture(), eventId = String(story.events[0]._id)
  const sheet = { id: eventId, title: 'Event', text: 'Notes' }
  assert.equal(validatePlanningSheets([sheet], story.events, true), null)
  assert.ok(validatePlanningSheets([sheet, sheet], story.events, true))
  assert.ok(validatePlanningSheets([sheet], story.threads, true))
  assert.ok(validatePlanningSheets([{ ...sheet, id: String(id()) }], story.events, true))
  assert.ok(validatePlanningSheets([sheet], [], false))
})

test('new stories save private event/thread text and never include it in reader responses', async () => {
  Story.create = async data => {
    assert.equal(data.events[0].text, 'Secret event')
    assert.equal(data.threads[0].text, 'Secret thread')
    const story = new Story(data); await story.validate(); return story
  }
  const res = resMock()
  await createStory({ user: { _id: ownerId }, body: { title: 'Story', chapters: [{ status: 'draft', title: '', text: '', images: [] }], events: [{ title: '', text: 'Secret event' }], threads: [{ title: '', text: 'Secret thread' }] } }, res)
  assert.equal(res.code, 201)
  assert.equal(JSON.stringify(res.data).includes('Secret'), false)
  assert.equal(Object.hasOwn(res.data, 'events'), false)
  assert.equal(Object.hasOwn(res.data, 'threads'), false)
})

test('owner editor returns each planning group with stable IDs and title/text fields', () => {
  const story = fixture(), res = resMock()
  getStoryEditor({ ownedStory: story }, res)
  assert.deepEqual(res.data.events[0], { id: String(story.events[0]._id), title: 'Private future event', text: 'Private event text.' })
  assert.deepEqual(res.data.threads[0], { id: String(story.threads[0]._id), title: 'Private ongoing thread', text: 'Private thread text.' })
  assert.equal(res.data.characters[0].name, 'Ayelen')
  assert.deepEqual(editorPlanningSheets({}), { events: [], threads: [] })
})

test('public reader includes characters while excluding private events and threads', async () => {
  const story = fixture()
  for (const user of [null, { _id: ownerId }, { _id: id(), role: 'admin' }]) {
    const view = readerStory(story, user)
    for (const field of ['events', 'threads']) assert.equal(Object.hasOwn(view, field), false)
    assert.equal(view.characters[0].intro, story.characters[0].notes)
    assert.equal(JSON.stringify(view).includes('Private future event'), false)
    assert.equal(JSON.stringify(view).includes('Private ongoing thread'), false)
    assert.equal(view.availableChapterCount, 1)
  }
  Story.find = () => ({ select() { return this }, populate() { return this }, sort() { return this }, lean: async () => [story.toObject()] })
  const res = resMock(); await listStories({}, res)
  assert.equal(JSON.stringify(res.data).includes('Private'), false)
})

test('the editor explicitly selects private groups and rejects other users including admins', async () => {
  const story = fixture()
  Story.findOne = async (_filter, projection) => {
    for (const group of ['characters', 'events', 'threads']) assert.ok(projection.includes(`+${group}`))
    return story
  }
  let allowed = false
  await requireStoryOwner({ user: { _id: ownerId }, params: { slug: story.slug } }, resMock(), () => { allowed = true })
  assert.equal(allowed, true)
  for (const role of ['reader', 'writer', 'admin']) {
    const res = resMock(); await requireStoryOwner({ user: { _id: id(), role }, params: { slug: story.slug } }, res, () => assert.fail('not owner'))
    assert.equal(res.code, 403)
  }
})

test('all planning categories save together without changing chapters or sending chapter notifications', async () => {
  const story = fixture(), body = bodyFor(story)
  body.events = [{ id: String(story.events[0]._id), title: 'Changed event', text: 'Changed private text' }, { title: '', text: 'Another rough idea' }]
  body.threads = [{ id: String(story.threads[0]._id), title: 'Changed thread', text: 'Thread progression' }]
  body.characters = [{ id: String(story.characters[0]._id), name: 'Ayelen', notes: 'Updated character note', images: [] }]
  mongoose.connection.transaction = async callback => callback({})
  Notification.bulkWrite = () => assert.fail('planning changes must not notify')
  Story.findOneAndUpdate = async (filter, pipeline) => {
    assert.equal(filter.creatorId, ownerId); assert.equal(filter.__v, 0)
    const fields = Object.fromEntries(Object.entries(pipeline[0].$set).filter(([, value]) => value.$literal !== undefined).map(([key, value]) => [key, value.$literal]))
    assert.equal(String(fields.events[0]._id), String(story.events[0]._id))
    assert.equal(fields.events[1].text, 'Another rough idea')
    assert.equal(String(fields.threads[0]._id), String(story.threads[0]._id))
    assert.equal(fields.characters[0].notes, 'Updated character note')
    assert.equal(String(pipeline[0].$set.chapters.$map.input.$literal[0]._id), String(story.chapters[0]._id))
    assert.ok(pipeline[0].$set.chapters.$map.in.$mergeObjects)
    const saved = new Story({ ...story.toObject(), ...fields }); await saved.validate(); return saved
  }
  const res = resMock(); await updateStory({ ownedStory: story, user: { _id: ownerId }, body }, res)
  assert.equal(res.code, 200)
  assert.equal(res.data.availableChapterCount, 1)
  assert.equal(res.data.slides[0].text, 'Public story text.')
})

test('older save requests preserve planning groups and their archives when omitted', async () => {
  const story = fixture()
  mongoose.connection.transaction = async callback => callback({})
  Story.findOneAndUpdate = async (_filter, pipeline) => {
    for (const key of ['events', 'threads', 'archivedEvents', 'archivedThreads']) assert.equal(Object.hasOwn(pipeline[0].$set, key), false)
    return story
  }
  const res = resMock(); await updateStory({ ownedStory: story, user: { _id: ownerId }, body: bodyFor(story) }, res)
  assert.equal(res.code, 200)
})

test('removed events and threads are archived instead of erased', async () => {
  const story = fixture(), body = { ...bodyFor(story), events: [], threads: [] }
  mongoose.connection.transaction = async callback => callback({})
  Story.findOneAndUpdate = async (_filter, pipeline) => {
    for (const [group, archive] of [['events', 'archivedEvents'], ['threads', 'archivedThreads']]) {
      assert.deepEqual(pipeline[0].$set[group].$literal, [])
      const operation = pipeline[0].$set[archive].$concatArrays
      assert.deepEqual(operation[0], { $ifNull: [`$${archive}`, []] })
      assert.deepEqual(operation[1].$map.input.$filter.input, { $ifNull: [`$${group}`, []] })
      assert.ok(operation[1].$map.in.$mergeObjects[1].deletedAt.$literal instanceof Date)
    }
    return story
  }
  const res = resMock(); await updateStory({ ownedStory: story, user: { _id: ownerId }, body }, res)
  assert.equal(res.code, 200)
})

test('preparing private sheets preserves timestamps and strips unrelated input fields', () => {
  const story = fixture(), createdAt = new Date('2026-01-01T00:00:00Z')
  story.events[0].createdAt = createdAt
  const result = preparePlanningSheets([{ id: String(story.events[0]._id), title: '  Event  ', text: '  Notes stay exact  ', ignored: true }], story.events)
  assert.equal(result[0].title, 'Event')
  assert.equal(result[0].text, '  Notes stay exact  ')
  assert.equal(result[0].createdAt, createdAt)
  assert.equal(Object.hasOwn(result[0], 'ignored'), false)
})

test('frontend serialization keeps persisted IDs and restores the selected planning view after saving', () => {
  const events = loadPlanningSheets([{ id: 'saved-event', title: 'Event', text: 'Text' }])
  const threads = loadPlanningSheets([{ id: 'saved-thread', title: 'Thread', text: 'Text' }])
  assert.equal(events[0].sheetId, 'saved-event')
  assert.deepEqual(serializePlanningSheets(events), [{ id: 'saved-event', title: 'Event', text: 'Text' }])
  assert.deepEqual(serializePlanningSheets([{ id: 'local-id', title: '', text: '' }]), [{ title: '', text: '' }])
  assert.deepEqual(restorePlanningSelection({ type: 'events', index: 0 }, events, threads), { type: 'events', index: 0 })
  assert.deepEqual(restorePlanningSelection({ type: 'threads', index: 0 }, events, threads), { type: 'threads', index: 0 })
  assert.equal(restorePlanningSelection({ type: 'events', index: 4 }, events, threads), null)
  assert.equal(restorePlanningSelection({ type: 'characters', index: 0 }, events, threads), null)
  assert.equal(events[0].text, 'Text')
})

test('planning sheets cannot bypass story version protection or publication validation', async () => {
  const story = fixture(), body = { ...bodyFor(story), version: -1, events: [{ title: '', text: '' }] }
  Story.findOneAndUpdate = () => assert.fail('must not overwrite newer work')
  const res = resMock(); await updateStory({ ownedStory: story, user: { _id: ownerId }, body }, res)
  assert.equal(res.code, 409)
  assert.match(validateStoryInput({ ...body, events: [{ title: '', text: '', status: 'published' }] }, true, story), /always private/)
})
