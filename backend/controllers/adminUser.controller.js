import mongoose from 'mongoose'
import User from '../models/user.model.js'
import Story from '../models/story.model.js'
import Comment from '../models/comment.model.js'

export const listUsers = async (req, res) => {
  res.set('Cache-Control', 'private, no-store')
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1))
  const limit = 24
  try {
    const [users, total] = await Promise.all([
      User.find().select('_id username email role profilePic createdAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(),
    ])
    return res.json({ users, page, total, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch { return res.status(500).json({ error: 'Unable to load users.' }) }
}

export const getUserDetails = async (req, res) => {
  res.set('Cache-Control', 'private, no-store')
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid user ID.' })
  try {
    const user = await User.findById(req.params.id).select('_id username email role profilePic profilePicPublicId profilePicUploadedAt createdAt updatedAt +profilePicHistory').lean()
    if (!user) return res.status(404).json({ error: 'User not found.' })
    const [stories, counts, authored] = await Promise.all([
      Story.find({ 'chapters.commentedUserIds': user._id }).select('title slug deletedAt chapters._id chapters.number chapters.title chapters.commentedUserIds').lean(),
      Comment.aggregate([{ $match: { author: user._id } }, { $group: { _id: '$storyId', count: { $sum: 1 } } }]),
      Story.find({ creatorId: user._id }).select('title slug deletedAt').lean(),
    ])
    const history = (user.profilePicHistory || []).map(photo => ({ id: String(photo._id), url: photo.url, uploadedAt: photo.uploadedAt, deletedAt: photo.deletedAt, current: photo.url === user.profilePic && !photo.deletedAt }))
    if (user.profilePic && !history.some(photo => photo.url === user.profilePic)) history.push({ id: 'current', url: user.profilePic, uploadedAt: user.profilePicUploadedAt, deletedAt: null, current: true })
    return res.json({ user: { _id: user._id, username: user.username, email: user.email, role: user.role, profilePic: user.profilePic, createdAt: user.createdAt, updatedAt: user.updatedAt },
      photoHistory: history.reverse(),
      participation: stories.map(story => ({ id: story.slug, title: story.title, deleted: !!story.deletedAt,
        commentCount: counts.find(row => String(row._id) === String(story._id))?.count || 0,
        chapters: story.chapters.filter(chapter => chapter.commentedUserIds.some(id => String(id) === String(user._id))).map(chapter => ({ id: String(chapter._id), number: chapter.number, title: chapter.title })),
      })),
      authoredStories: authored.map(story => ({ id: story.slug, title: story.title, deleted: !!story.deletedAt })),
      readingHistoryTracked: false,
    })
  } catch { return res.status(500).json({ error: 'Unable to load user details.' }) }
}
