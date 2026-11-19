import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import mongoose from 'mongoose'
import Comment from '../models/comment.model.js'
import Story from '../models/story.model.js'
import { commentTree } from '../controllers/comment.controller.js'
import { setCommentReaction } from '../controllers/commentReaction.controller.js'
import { reactionSummary, reactionUpdate, validReactionEmoji } from './commentReactions.js'

const id = () => new mongoose.Types.ObjectId()
const userId = id(), otherUserId = id(), chapterId = id(), commentId = id(), storyId = id()
const document = () => ({ _id: commentId, storyId, chapterId, author: otherUserId, authorName: 'Reader', body: 'An interesting chapter with a lot to discuss.', reactions: [] })
let originalFind, originalUpdate
beforeEach(() => { originalFind = Story.findOne; originalUpdate = Comment.findOneAndUpdate })
afterEach(() => { Story.findOne = originalFind; Comment.findOneAndUpdate = originalUpdate })
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
