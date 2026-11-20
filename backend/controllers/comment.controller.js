import { hasPublishedChapters, isPublishedChapter } from '../lib/chapterPublication.js'
import { reactionSummary } from '../lib/commentReactions.js'
import User from '../models/user.model.js'
import { effectiveCommentRestriction, restrictionMessage } from '../lib/commentRestriction.js'
import { commentQualityMessage } from '../lib/commentQuality.js'
import { notifyReply } from '../lib/replyNotification.js'
import Comment from '../models/comment.model.js'
import { ensureCommentMigration, migrateStoryComments } from '../lib/migrateComments.js'
import mongoose from 'mongoose'
import { loadStory } from '../lib/storyRepository.js'
import { canReadChapter } from '../lib/storyAccess.js'
import Story from '../models/story.model.js'

export const DELETED_COMMENT_MESSAGE = 'This comment has been deleted by an admin or moderator.'
export const commentTree = (comments, userId = null) => {
  const nodes = new Map(comments.map(comment => [String(comment._id), {
    id: String(comment._id), authorId: String(comment.author?._id || comment.author), author: comment.author?.username || comment.authorName,
    ...(comment.deletedAt ? { reactions: [], myReaction: null } : reactionSummary(comment.reactions, userId)),
    profilePic: comment.author?.profilePic || null, deleted: !!comment.deletedAt, hidden: !!comment.deletedAt && comment.deletionMode === 'hidden', body: comment.deletedAt ? DELETED_COMMENT_MESSAGE : comment.body, createdAt: comment.createdAt, replies: [],
  }]))
  const roots = []
  for (const comment of comments) {
    const node = nodes.get(String(comment._id))
    const parent = comment.parentId && nodes.get(String(comment.parentId))
    if (parent) parent.replies.push(node)
    else roots.push(node)
  }
  const visible = nodes => nodes.filter(node => !node.hidden).map(node => ({ ...node, replies: visible(node.replies) }))
  return visible(roots)
}

export const getDiscussion = async (req, res) => {
  res.set('Cache-Control', 'private, no-store')
  try {
    const story = await loadStory(req.params.slug)
    if (!story || !hasPublishedChapters(story)) return res.status(404).json({ error: 'Story not found.' })
    await ensureCommentMigration(story)
    const readableIds = story.chapters.filter((_chapter, index) => canReadChapter(story, index, req.user)).map(chapter => chapter._id)
    const comments = await Comment.find({ storyId: story._id, chapterId: { $in: readableIds } }).sort({ createdAt: 1, _id: 1 }).populate('author', 'username profilePic').lean()
    return res.json({ commentRestriction: effectiveCommentRestriction(req.user), userId: req.user ? String(req.user._id) : null, chapters: story.chapters.map((chapter, index) => ({
      id: String(chapter._id), number: chapter.number,
      hasCommented: !!req.user && chapter.commentedUserIds.some(id => String(id) === String(req.user._id)),
      comments: (req.user ? canReadChapter(story, index, req.user) : index === 0) ? commentTree(comments.filter(comment => String(comment.chapterId) === String(chapter._id)), req.user?._id) : [],
    })).filter((_chapter, index) => isPublishedChapter(story.chapters[index])) })
  } catch { return res.status(500).json({ error: 'Unable to load discussion and reading progress.' }) }
}

export const postComment = async (req, res) => {
  const restriction = effectiveCommentRestriction(req.user)
  if (restriction.status !== 'none') return res.status(403).json({ code: 'COMMENT_RESTRICTED', commentRestriction: restriction, error: restrictionMessage(restriction) })
  const { body, parentId } = req.body || {}
  if (typeof body !== 'string' || !body.trim() || body.length > 1000) return res.status(400).json({ error: 'Enter a comment of 1–1000 characters.' })
  const qualityMessage = commentQualityMessage(body)
  if (qualityMessage) return res.status(422).json({ code: 'COMMENT_NEEDS_DETAIL', error: qualityMessage })
  if (!mongoose.isValidObjectId(req.params.chapterId) || (parentId && !mongoose.isValidObjectId(parentId))) return res.status(400).json({ error: 'Invalid chapter or reply ID.' })
  try {
    let story = await loadStory(req.params.slug)
    if (!story) return res.status(404).json({ error: 'Story not found.' })
    const index = story.chapters.findIndex(chapter => String(chapter._id) === req.params.chapterId)
    if (index < 0) return res.status(404).json({ error: 'Chapter not found.' })
    if (!canReadChapter(story, index, req.user)) return res.status(403).json({ error: 'Comment on the preceding chapters before continuing.' })
    const fail = (status, message) => { const error = new Error(message); error.status = status; throw error }
    let savedChapter
    let savedComments
    await mongoose.connection.transaction(async session => {
      const currentUser = await User.findById(req.user._id).select('commentRestriction').session(session)
      if (!currentUser) fail(401, 'Account no longer exists.')
      const currentRestriction = effectiveCommentRestriction(currentUser)
      if (currentRestriction.status !== 'none') fail(403, restrictionMessage(currentRestriction))
      story = await Story.findOne({ slug: req.params.slug, deletedAt: null }).session(session)
      if (!story) fail(404, 'Story not found.')
      const currentIndex = story.chapters.findIndex(chapter => String(chapter._id) === req.params.chapterId)
      if (currentIndex < 0) fail(404, 'Chapter not found.')
      if (!canReadChapter(story, currentIndex, req.user)) fail(403, 'Comment on the preceding chapters before continuing.')
      const chapter = story.chapters[currentIndex]
      await migrateStoryComments(story, session)
      const parent = parentId ? await Comment.findOne({ _id: parentId, storyId: story._id, chapterId: chapter._id }).session(session) : null
      if (parentId && !parent) fail(404, 'Reply target not found in this chapter.')
      if (parent?.deletedAt && parent.deletionMode === 'hidden') fail(404, 'Reply target is no longer visible.')
      if (parent?.depth >= 2) fail(400, 'Replies are limited to two levels.')
      if (parent) await Comment.updateOne({ _id: parent._id }, { $set: { updatedAt: new Date() } }, { session })
      const [reply] = await Comment.create([{
        author: req.user._id, authorName: req.user.username, profilePic: req.user.profilePic,
        storyId: story._id, chapterId: chapter._id,
        body: body.trim(), parentId: parentId || null, depth: parent ? parent.depth + 1 : 0,
      }], { session })
      await notifyReply({ parent, reply, story, chapter, user: req.user, session })
      const result = await Story.updateOne({ _id: story._id, deletedAt: null, 'chapters._id': chapter._id }, {
        $addToSet: { 'chapters.$.commentedUserIds': req.user._id },
      }, { session })
      if (result.matchedCount !== 1) fail(404, 'Story or chapter no longer exists.')
      savedChapter = { id: chapter._id, number: chapter.number }
      savedComments = await Comment.find({ storyId: story._id, chapterId: chapter._id }).sort({ createdAt: 1, _id: 1 }).session(session).populate('author', 'username profilePic').lean()
    })
    return res.status(201).json({ chapterId: String(savedChapter.id), number: savedChapter.number, hasCommented: true, comments: commentTree(savedComments, req.user._id) })
  } catch (error) { return res.status(error.status || 500).json({ error: error.status ? error.message : 'Your comment could not be saved. Please try again.' }) }
}

export const softDeleteComment = async (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' })
  if (!mongoose.isValidObjectId(req.params.chapterId) || !mongoose.isValidObjectId(req.params.commentId)) return res.status(400).json({ error: 'Invalid chapter or comment ID.' })
  try {
    const story = await loadStory(req.params.slug)
    if (!story) return res.status(404).json({ error: 'Story not found.' })
    if (!story.chapters.some(chapter => String(chapter._id) === req.params.chapterId)) return res.status(404).json({ error: 'Chapter not found.' })
    await ensureCommentMigration(story)
    const scope = { _id: req.params.commentId, storyId: story._id, chapterId: req.params.chapterId }
    const mode = req.body?.mode || 'notice'
    if (!['notice', 'hidden'].includes(mode)) return res.status(400).json({ error: 'Choose notice or hidden deletion.' })
    let found = false
    let hidden = false
    await mongoose.connection.transaction(async session => {
      const target = await Comment.findOne(scope).session(session)
      if (!target) return
      found = true
      hidden = mode === 'hidden' || (target.deletedAt && target.deletionMode === 'hidden')
      if (mode === 'hidden') {
        const all = await Comment.find({ storyId: story._id, chapterId: req.params.chapterId }).session(session).lean()
        const ids = new Set([String(target._id)])
        let changed = true
        while (changed) {
          changed = false
          for (const comment of all) if (comment.parentId && ids.has(String(comment.parentId)) && !ids.has(String(comment._id))) { ids.add(String(comment._id)); changed = true }
        }
        await Comment.updateMany({ storyId: story._id, chapterId: req.params.chapterId, _id: { $in: [...ids] } }, {
          $set: { deletionMode: 'hidden', deletedAt: new Date(), deletedBy: req.user._id },
        }, { session })
      } else if (!target.deletedAt) {
        await Comment.updateOne(scope, { $set: { deletionMode: 'notice', deletedAt: new Date(), deletedBy: req.user._id } }, { session })
      }
    })
    if (!found) return res.status(404).json({ error: 'Comment not found in this chapter.' })
    res.set('Cache-Control', 'private, no-store')
    return res.json({ id: req.params.commentId, deleted: true, hidden: !!hidden, body: DELETED_COMMENT_MESSAGE })
  } catch { return res.status(500).json({ error: 'Unable to delete this comment. Please try again.' }) }
}
