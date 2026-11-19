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
