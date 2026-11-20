import mongoose from 'mongoose'
import Notification from '../models/notification.model.js'

export const listNotifications = async (req, res) => {
  res.set('Cache-Control', 'private, no-store')
  try {
    const [result] = await Notification.aggregate([
      { $match: { recipient: new mongoose.Types.ObjectId(String(req.user._id)) } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $lookup: { from: 'stories', localField: 'storyId', foreignField: '_id', as: 'story' } },
      { $unwind: '$story' },
      { $match: { 'story.deletedAt': null, 'story.chapters': { $elemMatch: { status: { $ne: 'draft' } } } } },
      { $lookup: { from: 'comments', localField: 'commentId', foreignField: '_id', as: 'comment' } },
      { $unwind: { path: '$comment', preserveNullAndEmptyArrays: true } },
      { $match: { $or: [{ type: { $in: ['new_chapter', 'story_invite'] } }, { $and: [{ 'comment._id': { $exists: true } }, { 'comment.deletedAt': null }] }] } },
      { $set: { chapter: { $arrayElemAt: [{ $filter: { input: '$story.chapters', as: 'chapter', cond: { $eq: ['$$chapter._id', '$chapterId'] } } }, 0] } } },
      { $match: { $or: [{ type: 'story_invite' }, { 'chapter._id': { $exists: true } }] } },
      { $match: { $or: [{ type: 'story_invite' }, { 'chapter.status': { $ne: 'draft' } }] } },
      { $lookup: { from: 'users', localField: 'actor', foreignField: '_id', as: 'actorUser' } },
      { $facet: {
        unread: [{ $match: { readAt: null } }, { $count: 'count' }],
        items: [{ $limit: 30 }, { $project: {
          type: 1, chapterNumber: '$chapter.number', _id: 0, id: { $toString: '$_id' }, actorName: { $ifNull: [{ $arrayElemAt: ['$actorUser.username', 0] }, 'Someone'] },
          storyTitle: '$story.title', contentRating: '$story.contentRating', slug: '$story.slug', chapterId: { $toString: '$chapterId' },
          commentId: { $toString: '$commentId' }, readAt: 1, createdAt: 1,
        } }],
      } },
    ])
    return res.json({ items: result?.items || [], unreadCount: result?.unread[0]?.count || 0 })
  } catch { return res.status(500).json({ error: 'Unable to load notifications.' }) }
}

export const markNotificationRead = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid notification ID.' })
  try {
    const scope = { _id: req.params.id, recipient: req.user._id }
    const notification = await Notification.findOneAndUpdate({ ...scope, readAt: null }, { $set: { readAt: new Date() } }, { new: true }) || await Notification.findOne(scope)
    if (!notification) return res.status(404).json({ error: 'Notification not found.' })
    return res.json({ id: String(notification._id), readAt: notification.readAt })
  } catch { return res.status(500).json({ error: 'Unable to update notification.' }) }
}

export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, readAt: null }, { $set: { readAt: new Date() } })
    return res.json({ message: 'Notifications marked as read.' })
  } catch { return res.status(500).json({ error: 'Unable to update notifications.' }) }
}
