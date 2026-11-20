import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import mongoose from 'mongoose'
import User from '../models/user.model.js'
import Notification from '../models/notification.model.js'
import { searchInvitees, sendStoryInvitation } from '../controllers/storyInvitation.controller.js'
import { listNotifications } from '../controllers/notification.controller.js'
import { getProfile, updatePreferences } from '../controllers/user.controller.js'
import { reserveStoryInvitation } from './storyInvitations.js'
import { notificationLink } from '../../frontend/src/lib/notificationLinks.js'

const id = () => new mongoose.Types.ObjectId()
const actorId = id(), recipientId = id(), storyId = id()
const request = () => ({ user: { _id: actorId, role: 'writer' }, ownedStory: { _id: storyId, creatorId: actorId, chapters: [{ _id: id(), status: 'published' }], contentRating: 'everyone' }, query: { q: 'Re' }, body: { username: 'Reader' } })
const resMock = () => ({ code: 200, set() { return this }, status(code) { this.code = code; return this }, json(data) { this.data = data; return this } })
let original
beforeEach(() => {
  original = { userFind: User.find, userOne: User.findOne, userUpdate: User.findOneAndUpdate, userPatch: User.updateOne, userByIdUpdate: User.findByIdAndUpdate,
    exists: Notification.exists, create: Notification.create, indexes: Notification.createIndexes, drop: Notification.collection.dropIndex, aggregate: Notification.aggregate }
  User.findOne = () => ({ select: async () => ({ _id: recipientId, username: 'Reader' }) })
  User.findOneAndUpdate = () => ({ select: async () => ({ _id: actorId }) })
  User.updateOne = async () => ({ modifiedCount: 1 })
  Notification.exists = async () => null
  Notification.createIndexes = async () => []
  Notification.collection.dropIndex = async () => {}
})
afterEach(() => {
  User.find = original.userFind; User.findOne = original.userOne; User.findOneAndUpdate = original.userUpdate; User.updateOne = original.userPatch; User.findByIdAndUpdate = original.userByIdUpdate
  Notification.exists = original.exists; Notification.create = original.create; Notification.createIndexes = original.indexes; Notification.collection.dropIndex = original.drop; Notification.aggregate = original.aggregate
})

test('invitation notifications need a story, sender and recipient, while reply requirements are preserved', async () => {
  const invite = new Notification({ type: 'story_invite', recipient: recipientId, actor: actorId, storyId })
  await invite.validate()
  assert.equal(invite.chapterId, undefined)
  const reply = new Notification({ type: 'reply', recipient: recipientId, actor: actorId, storyId })
  await assert.rejects(reply.validate(), /chapterId/)
  const index = Notification.schema.indexes().find(([, options]) => options.name === 'recipient_story_invite_pending_unique')
  assert.deepEqual(index[0], { recipient: 1, storyId: 1 })
  assert.equal(index[1].unique, true)
  assert.deepEqual(index[1].partialFilterExpression, { type: 'story_invite', readAt: null })
})

test('only story owners can search or invite, including protection against deleted stories', async () => {
  User.find = User.findOne = () => assert.fail('not authorized')
  for (const change of [req => { req.user = null }, req => { req.ownedStory.creatorId = id() }, req => { req.ownedStory.deletedAt = new Date() }]) {
    for (const handler of [searchInvitees, sendStoryInvitation]) {
      const req = request(); change(req)
      const res = resMock(); await handler(req, res)
      assert.equal(res.code, 403)
    }
  }
})

test('mature-story username search respects invitation opt-out without filtering by feed preferences', async () => {
  const req = request(); req.ownedStory.contentRating = 'mature'
  User.find = filter => {
    assert.deepEqual(filter._id, { $ne: actorId })
    assert.deepEqual(filter.allowStoryInvitations, { $ne: false })
    assert.equal(filter.showMatureStories, undefined)
    assert.deepEqual(filter.username, { $regex: '^Re', $options: 'i' })
    return { select(fields) { assert.equal(fields, '_id username profilePic'); return this }, sort() { return this }, limit(count) { assert.equal(count, 10); return this },
      lean: async () => [{ _id: recipientId, username: 'Reader', email: 'private@example.com', profilePic: '/current-photo.jpg' }] }
  }
  const res = resMock(); await searchInvitees(req, res)
  assert.deepEqual(res.data, { users: [{ id: String(recipientId), username: 'Reader', profilePic: '/current-photo.jpg' }] })
})

test('search requires at least two letters/numbers and cannot become a full user directory', async () => {
  User.find = () => assert.fail('should not query')
  for (const q of ['', 'R', '.*', 'Reader.*']) {
    const req = request(); req.query.q = q
    const res = resMock(); await searchInvitees(req, res)
    assert.equal(res.code, q.length < 2 ? 200 : 400)
  }
})

test('invitations save the correct story and author, not recipient IDs supplied by the client', async () => {
  User.findOne = filter => {
    assert.equal(filter.username, 'Reader')
    assert.deepEqual(filter._id, { $ne: actorId })
    return { select: async () => ({ _id: recipientId, username: 'Reader' }) }
  }
  Notification.create = async data => {
    assert.deepEqual(data, { type: 'story_invite', recipient: recipientId, actor: actorId, storyId, readAt: null })
    await new Notification(data).validate()
  }
  const req = request(); req.body.recipientId = String(id())
  const res = resMock(); await sendStoryInvitation(req, res)
  assert.equal(res.code, 201)
  assert.deepEqual(res.data, { username: 'Reader', alreadySent: false })
})

test('unavailable or opted-out recipients still cannot be invited to mature stories', async () => {
  const req = request(); req.ownedStory.contentRating = 'mature'
  User.findOne = filter => {
    assert.equal(filter.showMatureStories, undefined)
    assert.deepEqual(filter.allowStoryInvitations, { $ne: false })
    return { select: async () => null }
  }
  Notification.create = () => assert.fail('should not notify')
  const res = resMock(); await sendStoryInvitation(req, res)
  assert.equal(res.code, 404)
})

test('pending duplicate invites do not consume quota or create notifications', async () => {
  Notification.exists = async scope => { assert.equal(scope.readAt, null); assert.equal(scope.storyId, storyId); return { _id: id() } }
  User.findOneAndUpdate = () => assert.fail('must not consume quota')
  Notification.create = () => assert.fail('must not create duplicate')
  const res = resMock(); await sendStoryInvitation(request(), res)
  assert.equal(res.code, 200)
  assert.equal(res.data.alreadySent, true)
})

test('the rolling 24-hour quota is reserved atomically and retains at most twenty recent attempts', async () => {
  User.findOneAndUpdate = (filter, pipeline, options) => {
    assert.equal(filter._id, actorId)
    assert.equal(filter.$expr.$lt[1], 20)
    const recent = filter.$expr.$lt[0].$size
    assert.deepEqual(recent.$filter.input, { $ifNull: ['$storyInviteRate', []] })
    assert.ok(Math.abs(Date.now() - recent.$filter.cond.$gte[1].$literal.getTime() - 86400000) < 1000)
    assert.deepEqual(pipeline[0].$set.storyInviteRate.$concatArrays[0], recent)
    assert.equal(options.updatePipeline, true)
    assert.equal(typeof pipeline[0].$set.storyInviteRate.$concatArrays[1].$literal[0].requestId, 'string')
    return { select: async () => ({ _id: actorId }) }
  }
  assert.equal(typeof await reserveStoryInvitation(actorId), 'string')
})

test('exhausted quota returns 429 without creating an invitation', async () => {
  User.findOneAndUpdate = () => ({ select: async () => null })
  Notification.create = () => assert.fail('must not create')
  const res = resMock(); await sendStoryInvitation(request(), res)
  assert.equal(res.code, 429)
})

test('failed or concurrently duplicated inserts refund their own quota reservation', async () => {
  for (const duplicate of [false, true]) {
    let refunded = false
    Notification.create = async () => { const error = new Error('save failed'); if (duplicate) error.code = 11000; throw error }
    User.updateOne = async (filter, update) => {
      assert.equal(filter._id, actorId)
      assert.equal(typeof update.$pull.storyInviteRate.requestId, 'string')
      refunded = true
    }
    const res = resMock(); await sendStoryInvitation(request(), res)
    assert.equal(res.code, duplicate ? 200 : 500)
    assert.equal(refunded, true)
  }
})

test('profile invitation preference defaults on, persists independently and validates booleans', async () => {
  const user = new User({ username: 'Reader', email: 'reader@example.com', password: 'hashed' })
  assert.equal(user.allowStoryInvitations, true)
  const profile = resMock(); getProfile({ user }, profile)
  assert.equal(profile.data.allowStoryInvitations, true)
  User.findByIdAndUpdate = (_id, update) => {
    assert.deepEqual(update, { $set: { allowStoryInvitations: false } })
    return { select: async () => ({ allowStoryInvitations: false }) }
  }
  const res = resMock(); await updatePreferences({ user: { _id: recipientId }, body: { allowStoryInvitations: false } }, res)
  assert.deepEqual(res.data, { allowStoryInvitations: false })
  const invalid = resMock(); await updatePreferences({ user: { _id: recipientId }, body: { allowStoryInvitations: 'false' } }, invalid)
  assert.equal(invalid.code, 400)
})

test('invitation notifications remain visible with either mature feed preference', async () => {
  for (const enabled of [false, true]) {
    Notification.aggregate = async pipeline => {
      const text = JSON.stringify(pipeline)
      assert.ok(text.includes('story_invite'))
      const chapterFilter = pipeline.find(stage => stage.$match?.$or?.some(condition => condition['chapter._id']))
      assert.deepEqual(chapterFilter.$match.$or[0], { type: 'story_invite' })
      assert.equal(pipeline.some(stage => stage.$match?.$or?.some(condition => condition['story.contentRating'])), false)
      return [{ items: [{ type: 'story_invite', slug: 'a-tale', actorName: 'Author' }], unread: [{ count: 1 }] }]
    }
    const res = resMock(); await listNotifications({ user: { _id: recipientId, showMatureStories: enabled } }, res)
    assert.equal(res.data.unreadCount, 1)
    assert.equal(res.data.items[0].type, 'story_invite')
  }
})

test('invitation links open the story directly and preserve reply/new-chapter destinations', () => {
  assert.equal(notificationLink({ type: 'story_invite', slug: 'a-tale' }), '/stories/a-tale')
  assert.equal(notificationLink({ type: 'new_chapter', slug: 'a-tale', chapterId: 'chapter' }), '/stories/a-tale?chapter=chapter')
  assert.equal(notificationLink({ type: 'reply', slug: 'a-tale', chapterId: 'chapter', commentId: 'comment' }), '/stories/a-tale?chapter=chapter#comment-comment')
})


test('a reader with mature feed visibility off can receive a mature-story invitation', async () => {
  const req = request(); req.ownedStory.contentRating = 'mature'
  User.findOne = filter => {
    assert.equal(filter.showMatureStories, undefined)
    assert.deepEqual(filter.allowStoryInvitations, { $ne: false })
    return { select: async () => ({ _id: recipientId, username: 'Reader', showMatureStories: false }) }
  }
  let created = false
  Notification.create = async data => { assert.equal(data.storyId, storyId); assert.equal(data.recipient, recipientId); created = true }
  const res = resMock(); await sendStoryInvitation(req, res)
  assert.equal(res.code, 201)
  assert.equal(created, true)
})
