import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import mongoose from 'mongoose'
import Story from '../models/story.model.js'
import { createStory, getStoryEditor, listStories, readerStory, updateStory, validateStoryInput } from '../controllers/story.controller.js'

const userId = new mongoose.Types.ObjectId()
const input = () => ({ title: 'A tale', chapters: [{ title: 'Beginning', text: 'The story begins here.', images: [] }] })
const savedStory = rating => new Story({ ...input(), slug: 'a-tale', creatorId: userId, contentRating: rating, __v: 0, chapters: [{ number: 1, ...input().chapters[0] }] })
const resMock = () => ({ code: 200, set() { return this }, status(code) { this.code = code; return this }, json(data) { this.data = data; return this } })
let originals
beforeEach(() => { originals = { create: Story.create, find: Story.find, update: Story.findOneAndUpdate, transaction: mongoose.connection.transaction } })
afterEach(() => { Story.create = originals.create; Story.find = originals.find; Story.findOneAndUpdate = originals.update; mongoose.connection.transaction = originals.transaction })

test('schema defaults to Unrated and validates the supported content ratings', async () => {
  const story = savedStory(undefined)
  assert.equal(story.contentRating, 'unrated')
  for (const value of ['unrated', 'everyone', 'teen', 'mature']) { story.contentRating = value; await story.validate() }
  story.contentRating = 'unknown'
  await assert.rejects(story.validate(), /contentRating/)
})

test('request validation rejects unknown ratings while accepting older clients without a rating', () => {
  assert.equal(validateStoryInput(input()), null)
  for (const value of ['unrated', 'everyone', 'teen', 'mature']) assert.equal(validateStoryInput({ ...input(), contentRating: value }), null)
  for (const value of [null, '', 'adult', 'Mature', 1, {}, ['mature']]) assert.match(validateStoryInput({ ...input(), contentRating: value }), /content rating/)
})

test('story creation persists its rating and exposes it to readers', async () => {
  for (const rating of ['everyone', 'teen', 'mature', undefined]) {
    Story.create = async data => {
      assert.equal(data.contentRating, rating || 'unrated')
      const story = new Story(data)
      await story.validate()
      return story
    }
    const res = resMock()
    await createStory({ body: { ...input(), ...(rating ? { contentRating: rating } : {}) }, user: { _id: userId } }, res)
    assert.equal(res.code, 201)
    assert.equal(res.data.contentRating, rating || 'unrated')
  }
})

test('reader and editor projections return the saved rating, with safe legacy fallback', () => {
  const story = savedStory('mature')
  assert.equal(readerStory(story).contentRating, 'mature')
  const res = resMock(); getStoryEditor({ ownedStory: story }, res)
  assert.equal(res.data.contentRating, 'mature')
  const legacy = story.toObject(); delete legacy.contentRating
  assert.equal(readerStory(legacy).contentRating, 'unrated')
  const oldRes = resMock(); getStoryEditor({ ownedStory: legacy }, oldRes)
  assert.equal(oldRes.data.contentRating, 'unrated')
})

test('library responses include rating labels without classifying older stories as Everyone', async () => {
  Story.find = () => ({ select(fields) { assert.ok(fields.includes('contentRating')); return this }, populate() { return this }, sort() { return this }, lean: async () => [{ slug: 'new', title: 'New', contentRating: 'mature' }, { slug: 'old', title: 'Old' }] })
  const res = resMock(); await listStories({ user: { showMatureStories: true } }, res)
  assert.equal(res.data[0].contentRating, 'mature')
  assert.equal(res.data[1].contentRating, 'unrated')
})

test('editing updates the rating atomically and preserves it when older clients omit the field', async () => {
  for (const rating of ['teen', 'unrated', undefined]) {
    const story = savedStory('mature')
    const body = { ...input(), version: 0, chapters: [{ ...input().chapters[0], id: String(story.chapters[0]._id) }] }
    if (rating !== undefined) body.contentRating = rating
    mongoose.connection.transaction = async callback => callback({})
    Story.findOneAndUpdate = async (filter, pipeline) => {
      assert.equal(filter.__v, 0)
      assert.equal(pipeline[0].$set.contentRating.$literal, rating === undefined ? 'mature' : rating)
      story.contentRating = pipeline[0].$set.contentRating.$literal
      return story
    }
    const res = resMock(); await updateStory({ ownedStory: story, user: { _id: userId }, body }, res)
    assert.equal(res.code, 200)
    assert.equal(res.data.contentRating, rating === undefined ? 'mature' : rating)
  }
})
