import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import mongoose from 'mongoose'
import User from '../models/user.model.js'
import Story from '../models/story.model.js'
import { getProfile, signup, updatePreferences } from '../controllers/user.controller.js'
import { listStories } from '../controllers/story.controller.js'

const userId = new mongoose.Types.ObjectId()
const resMock = () => ({ code: 200, headers: {}, set(key, value) { this.headers[key] = value; return this }, status(code) { this.code = code; return this }, json(data) { this.data = data; return this } })
let originals
beforeEach(() => { originals = { userUpdate: User.findByIdAndUpdate, storyFind: Story.find, userFind: User.findOne, userCreate: User.create, secret: process.env.ACCESS_TOKEN_SECRET } })
afterEach(() => { User.findByIdAndUpdate = originals.userUpdate; Story.find = originals.storyFind; User.findOne = originals.userFind; User.create = originals.userCreate; if (originals.secret === undefined) delete process.env.ACCESS_TOKEN_SECRET; else process.env.ACCESS_TOKEN_SECRET = originals.secret })

test('new accounts default to hidden mature stories', () => {
  const user = new User({ username: 'NewReader', email: 'reader@example.com', password: 'hash' })
  assert.equal(user.showMatureStories, false)
})

test('profile responses restore saved preferences and treat legacy missing values as off', () => {
  for (const value of [true, false, undefined]) {
    const res = resMock()
    getProfile({ user: { _id: userId, username: 'Reader', role: 'reader', showMatureStories: value } }, res)
    assert.equal(res.data.showMatureStories, value === true)
  }
})

test('preference updates are saved only to the authenticated account and cannot change roles', async () => {
  for (const enabled of [true, false]) {
    User.findByIdAndUpdate = (id, update, options) => {
      assert.equal(id, userId)
      assert.deepEqual(update, { $set: { showMatureStories: enabled } })
      assert.equal(options.runValidators, true)
      return { select(fields) { assert.equal(fields, 'showMatureStories'); return Promise.resolve({ showMatureStories: enabled }) } }
    }
    const res = resMock()
    await updatePreferences({ user: { _id: userId }, body: { showMatureStories: enabled, role: 'admin', userId: 'someone-else' } }, res)
    assert.equal(res.code, 200)
    assert.deepEqual(res.data, { showMatureStories: enabled })
    assert.equal(res.headers['Cache-Control'], 'private, no-store')
  }
})

test('guests and nonboolean preferences cannot perform updates', async () => {
  User.findByIdAndUpdate = () => assert.fail('must not write')
  const guest = resMock(); await updatePreferences({ body: { showMatureStories: true } }, guest)
  assert.equal(guest.code, 401)
  for (const value of [undefined, null, 'true', 'false', 1, 0, {}, []]) {
    const res = resMock()
    await updatePreferences({ user: { _id: userId }, body: { showMatureStories: value } }, res)
    assert.equal(res.code, 400)
  }
})

test('missing accounts fail safely when saving preferences', async () => {
  User.findByIdAndUpdate = () => ({ select: async () => null })
  const res = resMock(); await updatePreferences({ user: { _id: userId }, body: { showMatureStories: true } }, res)
  assert.equal(res.code, 404)
})

test('guests, legacy accounts, readers, writers and admins all hide mature stories unless explicitly enabled', async () => {
  for (const user of [undefined, {}, { role: 'reader', showMatureStories: false }, { role: 'writer' }, { role: 'admin' }, { showMatureStories: 'true' }]) {
    Story.find = filter => {
      assert.deepEqual(filter.contentRating, { $ne: 'mature' })
      assert.equal(filter.deletedAt, null)
      assert.ok(filter.slug.$nin)
      return { select() { return this }, sort() { return this }, lean: async () => [] }
    }
    const res = resMock()
    await listStories({ user, query: { showMatureStories: 'true' } }, res)
    assert.equal(res.code, 200)
    assert.equal(res.headers['Cache-Control'], 'private, no-store')
  }
})

test('explicitly enabling mature stories includes them while keeping deletion filters', async () => {
  Story.find = filter => {
    assert.equal(filter.contentRating, undefined)
    assert.equal(filter.deletedAt, null)
    assert.ok(filter.slug.$nin)
    return { select() { return this }, sort() { return this }, lean: async () => [{ slug: 'mature', title: 'Mature story', contentRating: 'mature' }] }
  }
  const res = resMock()
  await listStories({ user: { _id: userId, showMatureStories: true } }, res)
  assert.equal(res.data[0].contentRating, 'mature')
})

test('signup cannot bypass the default using a supplied preference', async () => {
  process.env.ACCESS_TOKEN_SECRET = 'offline-test-secret'
  User.findOne = async () => null
  User.create = async input => { assert.equal(input.showMatureStories, undefined); return new User(input) }
  const res = resMock()
  await signup({ body: { username: 'NewReader', email: 'reader@example.com', password: 'password123', showMatureStories: true } }, res)
  assert.equal(res.code, 201)
  assert.equal(res.data.showMatureStories, false)
})
