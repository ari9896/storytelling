import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import mongoose from 'mongoose'
import User from '../models/user.model.js'
import Story from '../models/story.model.js'
import { setUserRole } from '../controllers/adminUser.controller.js'
import { signup } from '../controllers/user.controller.js'
import { requireStoryOwner } from '../controllers/story.controller.js'
import { adminRoute, writerRoute } from '../middleware/auth.middleware.js'
import { canReadChapter } from './storyAccess.js'

const id = () => new mongoose.Types.ObjectId()
const adminId = id(), targetId = id()
const resMock = () => ({ code: 200, set() { return this }, status(code) { this.code = code; return this }, json(data) { this.data = data; return this } })
let originals
beforeEach(() => { originals = { update: User.findOneAndUpdate, exists: User.exists, find: User.findOne, create: User.create, story: Story.findOne, secret: process.env.ACCESS_TOKEN_SECRET } })
afterEach(() => { User.findOneAndUpdate = originals.update; User.exists = originals.exists; User.findOne = originals.find; User.create = originals.create; Story.findOne = originals.story; if (originals.secret === undefined) delete process.env.ACCESS_TOKEN_SECRET; else process.env.ACCESS_TOKEN_SECRET = originals.secret })
const roleRequest = role => ({ user: { _id: adminId, role: 'admin' }, params: { id: String(targetId) }, body: { role } })

test('user schema accepts exactly reader, writer and admin, with reader as default', async () => {
  const user = new User({ username: 'SampleReader', email: 'reader@example.com', password: 'hashed' })
  assert.equal(user.role, 'reader')
  for (const role of ['reader', 'writer', 'admin']) { user.role = role; await user.validate() }
  user.role = 'owner'
  await assert.rejects(user.validate(), /role/)
})

test('writers and admins can upload; readers and guests cannot', () => {
  for (const role of ['reader', 'writer', 'admin', undefined]) {
    const res = resMock(); let allowed = false
    writerRoute({ user: role ? { role } : null }, res, () => { allowed = true })
    assert.equal(allowed, ['writer', 'admin'].includes(role))
    if (!allowed) assert.equal(res.code, 403)
  }
})

test('writer upload access does not grant administrator access', () => {
  const res = resMock()
  adminRoute({ user: { role: 'writer' } }, res, () => assert.fail('writer must not access admin controls'))
  assert.equal(res.code, 403)
})

test('only admins may promote or demote other users', async () => {
  User.findOneAndUpdate = () => assert.fail('must not write')
  for (const role of ['reader', 'writer', undefined]) {
    const req = roleRequest('writer'); req.user = role ? { role } : null
    const res = resMock(); await setUserRole(req, res)
    assert.equal(res.code, 403)
  }
})

test('admins can switch reader/writer roles and receive a minimal response', async () => {
  for (const role of ['reader', 'writer']) {
    User.findOneAndUpdate = (filter, update, options) => {
      assert.deepEqual(filter, { _id: String(targetId), role: { $in: ['reader', 'writer', 'user'] } })
      assert.deepEqual(update, { $set: { role } })
      assert.equal(options.runValidators, true)
      return { select(fields) { assert.equal(fields, '_id role'); return Promise.resolve({ _id: targetId, role, email: 'private@example.com' }) } }
    }
    const res = resMock(); await setUserRole(roleRequest(role), res)
    assert.equal(res.code, 200)
    assert.deepEqual(res.data, { user: { _id: String(targetId), role } })
  }
})

test('invalid roles and IDs cannot change accounts or grant admin privileges', async () => {
  User.findOneAndUpdate = () => assert.fail('must not write')
  for (const role of ['admin', 'owner', null, { role: 'writer' }]) {
    const res = resMock(); await setUserRole(roleRequest(role), res)
    assert.equal(res.code, 400)
  }
  const req = roleRequest('writer'); req.params.id = 'invalid'
  const res = resMock(); await setUserRole(req, res)
  assert.equal(res.code, 400)
})

test('admin accounts are preserved and unknown accounts return not found', async () => {
  User.findOneAndUpdate = () => ({ select: async () => null })
  User.exists = async () => ({ _id: adminId })
  const existing = resMock(); await setUserRole(roleRequest('reader'), existing)
  assert.equal(existing.code, 409)
  User.exists = async () => null
  const missing = resMock(); await setUserRole(roleRequest('writer'), missing)
  assert.equal(missing.code, 404)
})

test('signup ignores an attempted writer or admin role assignment', async () => {
  process.env.ACCESS_TOKEN_SECRET = 'offline-test-secret'
  User.findOne = async () => null
  User.create = async input => { assert.equal(input.role, undefined); return new User(input) }
  for (const role of ['writer', 'admin']) {
    const res = resMock()
    await signup({ body: { username: 'SampleReader', email: 'reader@example.com', password: 'password123', role } }, res)
    assert.equal(res.code, 201)
    assert.equal(res.data.role, 'reader')
  }
})

test('a writer can edit their own story but cannot edit someone else’s', async () => {
  Story.findOne = async () => ({ creatorId: targetId })
  const own = { params: { slug: 'test-story' }, user: { _id: targetId, role: 'writer' } }
  let allowed = false
  await requireStoryOwner(own, resMock(), () => { allowed = true })
  assert.equal(allowed, true)
  const other = { ...own, user: { _id: id(), role: 'writer' } }
  const res = resMock(); await requireStoryOwner(other, res, () => assert.fail('not the author'))
  assert.equal(res.code, 403)
})

test('writers bypass comment gates for their own story, not other authors’ stories', () => {
  const story = { creatorId: targetId, chapters: [{ commentedUserIds: [] }, { commentedUserIds: [] }] }
  assert.equal(canReadChapter(story, 1, { _id: targetId, role: 'writer' }), true)
  assert.equal(canReadChapter(story, 1, { _id: id(), role: 'writer' }), false)
})
