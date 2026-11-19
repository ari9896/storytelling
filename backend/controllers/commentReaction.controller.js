import User from '../models/user.model.js'
import mongoose from 'mongoose'
import Comment from '../models/comment.model.js'
import { loadStory } from '../lib/storyRepository.js'
import { canReadChapter } from '../lib/storyAccess.js'
import { effectiveCommentRestriction, restrictionMessage } from '../lib/commentRestriction.js'
import { reactionSummary, reactionUpdate, validReactionEmoji } from '../lib/commentReactions.js'

export const setCommentReaction = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in to react to comments.' })
  const { emoji } = req.body || {}
  if (emoji !== null && !validReactionEmoji(emoji)) return res.status(400).json({ error: 'Choose one emoji, or remove your current reaction.' })
  if (!mongoose.isValidObjectId(req.params.chapterId) || !mongoose.isValidObjectId(req.params.commentId)) return res.status(400).json({ error: 'Invalid chapter or comment ID.' })
  const restriction = effectiveCommentRestriction(req.user)
  if (emoji !== null && restriction.status !== 'none') return res.status(403).json({ code: 'COMMENT_RESTRICTED', error: restrictionMessage(restriction), commentRestriction: restriction })
  try {
    const story = await loadStory(req.params.slug)
    if (!story) return res.status(404).json({ error: 'Story not found.' })
    const index = story.chapters.findIndex(chapter => String(chapter._id) === req.params.chapterId)
    if (index < 0) return res.status(404).json({ error: 'Chapter not found.' })
    if (!canReadChapter(story, index, req.user)) return res.status(403).json({ error: 'This chapter is still locked.' })
    const comment = await Comment.findOneAndUpdate({
      _id: req.params.commentId, storyId: story._id, chapterId: req.params.chapterId, deletedAt: null,
    }, reactionUpdate(req.user._id, emoji), { new: true, updatePipeline: true }).lean()
    if (!comment) return res.status(404).json({ error: 'Comment is no longer available.' })
    res.set('Cache-Control', 'private, no-store')
    return res.json({ id: String(comment._id), chapterId: String(comment.chapterId), ...reactionSummary(comment.reactions, req.user._id) })
  } catch { return res.status(500).json({ error: 'Your reaction could not be saved. Please try again.' }) }
}

export const getReactionUsers = async (req, res) => {
  res.set('Cache-Control', 'private, no-store')
  const { emoji, page = '1', limit = '10' } = req.query
  if (!validReactionEmoji(emoji)) return res.status(400).json({ error: 'Choose one reaction emoji.' })
  if (!/^[1-9]\d*$/.test(String(page)) || !/^[1-9]\d*$/.test(String(limit)) || Number(page) > 100000 || Number(limit) > 50) return res.status(400).json({ error: 'Invalid reaction list page.' })
  if (!mongoose.isValidObjectId(req.params.chapterId) || !mongoose.isValidObjectId(req.params.commentId)) return res.status(400).json({ error: 'Invalid chapter or comment ID.' })
  try {
    const story = await loadStory(req.params.slug)
    if (!story) return res.status(404).json({ error: 'Story not found.' })
    const index = story.chapters.findIndex(chapter => String(chapter._id) === req.params.chapterId)
    if (index < 0) return res.status(404).json({ error: 'Chapter not found.' })
    if (!canReadChapter(story, index, req.user)) return res.status(403).json({ error: 'This chapter is still locked.' })
    const comment = await Comment.findOne({ _id: req.params.commentId, storyId: story._id, chapterId: req.params.chapterId, deletedAt: null }).select('reactions').lean()
    if (!comment) return res.status(404).json({ error: 'Comment is no longer available.' })
    const userIds = [...new Set((comment.reactions || []).filter(reaction => reaction.emoji === emoji).map(reaction => String(reaction.userId)))]
    const filter = { _id: { $in: userIds } }
    const pageNumber = Number(page), pageSize = Number(limit)
    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).select('username profilePic').sort({ username: 1, _id: 1 }).skip((pageNumber - 1) * pageSize).limit(pageSize).lean(),
    ])
    return res.json({ users: users.map(user => ({ id: String(user._id), username: user.username, profilePic: user.profilePic || null })),
      page: pageNumber, total, hasMore: pageNumber * pageSize < total })
  } catch { return res.status(500).json({ error: 'Unable to load people who reacted. Please try again.' }) }
}
