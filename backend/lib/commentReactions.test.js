import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import mongoose from 'mongoose'
import Comment from '../models/comment.model.js'
import Story from '../models/story.model.js'
import User from '../models/user.model.js'
import { commentTree } from '../controllers/comment.controller.js'
import { getReactionUsers, setCommentReaction } from '../controllers/commentReaction.controller.js'
import { reactionSummary, reactionUpdate, validReactionEmoji } from './commentReactions.js'

const id = () => new mongoose.Types.ObjectId()
const userId = id(), otherUserId = id(), chapterId = id(), commentId = id(), storyId = id()
const document = () => ({ _id: commentId, storyId, chapterId, author: otherUserId, authorName: 'Reader', body: 'An interesting chapter with a lot to discuss.', reactions: [] })
let originalFind, originalUpdate, originalCommentFind, originalUserFind, originalUserCount
beforeEach(() => { originalFind = Story.findOne; originalUpdate = Comment.findOneAndUpdate; originalCommentFind = Comment.findOne; originalUserFind = User.find; originalUserCount = User.countDocuments })
afterEach(() => { Story.findOne = originalFind; Comment.findOneAndUpdate = originalUpdate; Comment.findOne = originalCommentFind; User.find = originalUserFind; User.countDocuments = originalUserCount })
const resMock = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this }, set() { return this }, json(body) { this.body = body; return this } })
const request = emoji => ({ params: { slug: 'test-story', chapterId: String(chapterId), commentId: String(commentId) }, user: { _id: userId }, body: { emoji } })
const story = () => ({ _id: storyId, chapters: [{ _id: chapterId, commentedUserIds: [] }] })

test('accepts a single emoji including joined faces, skin tones, flags and keycaps', () => {
  for (const emoji of ['🔥', '💯', '❤️', '😼', '🥵', '👍🏽', '👨‍👩‍👧‍👦', '🇦🇷', '1️⃣']) assert.equal(validReactionEmoji(emoji), true, emoji)
  for (const input of [undefined, null, '', 'hello', ':fire:', '🔥🔥', '❤️ hello', '1', {}, ['🔥']]) assert.equal(validReactionEmoji(input), false)
})

test('aggregates counts and personal choice without exposing reactor IDs', () => {
  const summary = reactionSummary([{ userId, emoji: '🔥' }, { userId: otherUserId, emoji: '🔥' }, { userId: id(), emoji: '💯' }], userId)
  assert.deepEqual(summary, { reactions: [{ emoji: '🔥', count: 2 }, { emoji: '💯', count: 1 }], myReaction: '🔥' })
  assert.equal(JSON.stringify(summary).includes(String(userId)), false)
  assert.equal(reactionSummary([{ userId, emoji: '🔥' }]).myReaction, null)
  assert.deepEqual(reactionSummary(), { reactions: [], myReaction: null })
})

test('atomic replacement removes only the current user and handles legacy missing arrays', () => {
  const pipeline = reactionUpdate(userId, '💯')
  const [existing, added] = pipeline[0].$set.reactions.$concatArrays
  assert.deepEqual(existing.$filter.input, { $ifNull: ['$reactions', []] })
  assert.deepEqual(existing.$filter.cond, { $ne: ['$$reaction.userId', { $literal: userId }] })
  assert.deepEqual(added, { $literal: [{ userId, emoji: '💯' }] })
  assert.deepEqual(reactionUpdate(userId, null)[0].$set.reactions.$concatArrays[1], { $literal: [] })
})

test('model defaults support older comments and reject duplicate user reactions', async () => {
  const comment = new Comment(document())
  assert.deepEqual(comment.reactions.toObject(), [])
  await comment.validate()
  comment.reactions = [{ userId, emoji: '🔥' }, { userId, emoji: '💯' }]
  await assert.rejects(comment.validate(), /only one reaction/)
  comment.reactions = [{ userId, emoji: 'not an emoji' }]
  await assert.rejects(comment.validate())
})

test('discussion trees include reactions on replies, suppress deleted reactions and hide threads', () => {
  const parent = { ...document(), reactions: [{ userId, emoji: '🔥' }] }
  const reply = { ...document(), _id: id(), parentId: commentId, reactions: [{ userId, emoji: '💯' }] }
  const tree = commentTree([parent, reply], userId)
  assert.equal(tree[0].myReaction, '🔥')
  assert.equal(tree[0].replies[0].myReaction, '💯')
  parent.deletedAt = new Date()
  assert.deepEqual(commentTree([parent, reply], userId)[0].reactions, [])
  parent.deletionMode = 'hidden'
  assert.deepEqual(commentTree([parent, reply], userId), [])
})

test('unauthenticated and invalid requests never write reactions', async () => {
  Comment.findOneAndUpdate = () => assert.fail('unexpected write')
  const guest = request('🔥'); guest.user = null
  const guestRes = resMock(); await setCommentReaction(guest, guestRes)
  assert.equal(guestRes.statusCode, 401)
  const invalidRes = resMock(); await setCommentReaction(request('🔥🔥'), invalidRes)
  assert.equal(invalidRes.statusCode, 400)
  const badId = request('🔥'); badId.params.commentId = 'wrong'
  const badRes = resMock(); await setCommentReaction(badId, badRes)
  assert.equal(badRes.statusCode, 400)
})

test('locked chapters and unavailable stories cannot be reacted to', async () => {
  Comment.findOneAndUpdate = () => assert.fail('unexpected write')
  Story.findOne = async () => null
  const missing = resMock(); await setCommentReaction(request('🔥'), missing)
  assert.equal(missing.statusCode, 404)
  Story.findOne = async () => ({ _id: storyId, chapters: [{ _id: id(), commentedUserIds: [] }, { _id: chapterId }] })
  const locked = resMock(); await setCommentReaction(request('🔥'), locked)
  assert.equal(locked.statusCode, 403)
})

test('replacement and removal use scoped atomic updates and return only public counts', async () => {
  Story.findOne = async () => story()
  for (const emoji of ['💯', null]) {
    Comment.findOneAndUpdate = (filter, pipeline, options) => {
      assert.deepEqual(filter, { _id: String(commentId), storyId, chapterId: String(chapterId), deletedAt: null })
      assert.deepEqual(pipeline, reactionUpdate(userId, emoji))
      assert.equal(options.updatePipeline, true)
      assert.equal(options.new, true)
      return { lean: async () => ({ ...document(), reactions: emoji ? [{ userId, emoji }] : [] }) }
    }
    const res = resMock(); await setCommentReaction(request(emoji), res)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.myReaction, emoji)
    assert.deepEqual(res.body.reactions, emoji ? [{ emoji, count: 1 }] : [])
  }
})

test('deleted, wrong-chapter and wrong-story comments cannot be updated', async () => {
  Story.findOne = async () => story()
  Comment.findOneAndUpdate = (filter) => {
    assert.equal(filter.deletedAt, null)
    assert.equal(filter.storyId, storyId)
    assert.equal(filter.chapterId, String(chapterId))
    return { lean: async () => null }
  }
  const res = resMock(); await setCommentReaction(request('🔥'), res)
  assert.equal(res.statusCode, 404)
})

test('restricted users cannot add a reaction but can remove their existing reaction', async () => {
  Story.findOne = async () => story()
  Comment.findOneAndUpdate = () => ({ lean: async () => document() })
  const req = request('🔥'); req.user.commentRestriction = { status: 'indefinite', reason: 'Spam' }
  const blocked = resMock(); await setCommentReaction(req, blocked)
  assert.equal(blocked.statusCode, 403)
  assert.equal(blocked.body.code, 'COMMENT_RESTRICTED')
  req.body.emoji = null
  const removed = resMock(); await setCommentReaction(req, removed)
  assert.equal(removed.statusCode, 200)
})

const peopleRequest = (query = {}) => ({ ...request('🔥'), query: { emoji: '🔥', ...query } })
const commentQuery = value => ({ select(fields) { assert.equal(fields, 'reactions'); return this }, lean: async () => value })
const usersQuery = (users, expectedSkip, expectedLimit) => ({
  select(fields) { assert.equal(fields, 'username profilePic'); return this },
  sort(order) { assert.deepEqual(order, { username: 1, _id: 1 }); return this },
  skip(value) { assert.equal(value, expectedSkip); return this }, limit(value) { assert.equal(value, expectedLimit); return this }, lean: async () => users,
})

test('public hover preview caps at ten and whitelists profile data', async () => {
  Story.findOne = async () => story()
  const users = Array.from({ length: 12 }, (_, index) => ({ _id: id(), username: `Reader${index}`, profilePic: '/photo.jpg', email: 'private@example.com', signupIp: 'private' }))
  Comment.findOne = scope => {
    assert.deepEqual(scope, { _id: String(commentId), storyId, chapterId: String(chapterId), deletedAt: null })
    return commentQuery({ reactions: [...users.map(user => ({ userId: user._id, emoji: '🔥' })), { userId: otherUserId, emoji: '💯' }] })
  }
  const expectedIds = users.map(user => String(user._id))
  User.countDocuments = async filter => { assert.deepEqual(filter, { _id: { $in: expectedIds } }); return 12 }
  User.find = filter => { assert.deepEqual(filter, { _id: { $in: expectedIds } }); return usersQuery(users.slice(0, 10), 0, 10) }
  const req = peopleRequest(); req.user = null
  const res = resMock(); await getReactionUsers(req, res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.users.length, 10)
  assert.equal(res.body.total, 12)
  assert.equal(res.body.hasMore, true)
  for (const user of res.body.users) assert.deepEqual(Object.keys(user).sort(), ['id', 'profilePic', 'username'])
  assert.equal(JSON.stringify(res.body).includes('private'), false)
})

test('full lists paginate without returning unlimited users', async () => {
  Story.findOne = async () => story()
  Comment.findOne = () => commentQuery({ reactions: [{ userId, emoji: '🔥' }] })
  User.countDocuments = async () => 55
  User.find = () => usersQuery([{ _id: userId, username: 'Reader' }], 50, 50)
  const res = resMock(); await getReactionUsers(peopleRequest({ page: '2', limit: '50' }), res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.page, 2)
  assert.equal(res.body.hasMore, false)
  assert.equal(res.body.users[0].profilePic, null)
})

test('reaction lists reject invalid emojis, page sizes and identifiers before querying', async () => {
  Story.findOne = () => assert.fail('unexpected query')
  for (const query of [{ limit: '51' }, { page: '0' }, { page: '1abc' }, { limit: '-1' }, { emoji: 'hello' }]) {
    const res = resMock(); await getReactionUsers(peopleRequest(query), res)
    assert.equal(res.statusCode, 400)
  }
  const req = peopleRequest(); req.params.commentId = 'invalid'
  const res = resMock(); await getReactionUsers(req, res)
  assert.equal(res.statusCode, 400)
})

test('reaction identities are unavailable for locked chapters and deleted comments', async () => {
  Comment.findOne = () => assert.fail('must check chapter access first')
  Story.findOne = async () => ({ _id: storyId, chapters: [{ _id: id(), commentedUserIds: [] }, { _id: chapterId }] })
  const req = peopleRequest(); req.user = null
  const locked = resMock(); await getReactionUsers(req, locked)
  assert.equal(locked.statusCode, 403)
  Story.findOne = async () => story()
  Comment.findOne = scope => { assert.equal(scope.deletedAt, null); return commentQuery(null) }
  const deleted = resMock(); await getReactionUsers(peopleRequest(), deleted)
  assert.equal(deleted.statusCode, 404)
})
