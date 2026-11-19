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
    const user = await User.findById(req.params.id).select('_id username email role profilePic profilePicPublicId profilePicUploadedAt createdAt updatedAt commentRestriction +profilePicHistory').lean()
    if (!user) return res.status(404).json({ error: 'User not found.' })
    const [stories, counts, authored] = await Promise.all([
      Story.find({ 'chapters.commentedUserIds': user._id }).select('title slug deletedAt chapters._id chapters.number chapters.title chapters.commentedUserIds').lean(),
      Comment.aggregate([{ $match: { author: user._id } }, { $group: { _id: '$storyId', count: { $sum: 1 } } }]),
      Story.find({ creatorId: user._id }).select('title slug deletedAt').lean(),
    ])
    const history = (user.profilePicHistory || []).map(photo => ({ id: String(photo._id), url: photo.url, uploadedAt: photo.uploadedAt, deletedAt: photo.deletedAt, current: photo.url === user.profilePic && !photo.deletedAt }))
    if (user.profilePic && !history.some(photo => photo.url === user.profilePic)) history.push({ id: 'current', url: user.profilePic, uploadedAt: user.profilePicUploadedAt, deletedAt: null, current: true })
    return res.json({ user: { _id: user._id, username: user.username, email: user.email, role: user.role, profilePic: user.profilePic, createdAt: user.createdAt, updatedAt: user.updatedAt, commentRestriction: user.commentRestriction || { status: 'none' } },
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

export const setCommentRestriction = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid user ID.' })
  const { status, reason, expiresAt } = req.body || {}
  if (!['none', 'temporary', 'indefinite'].includes(status)) return res.status(400).json({ error: 'Choose none, temporary, or indefinite.' })
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) return res.status(400).json({ error: 'Provide a reason of 1–500 characters, including when restoring access.' })
  const expiry = status === 'temporary' ? new Date(expiresAt) : null
  if (status === 'temporary' && (!expiresAt || !Number.isFinite(expiry.getTime()) || expiry <= new Date())) return res.status(400).json({ error: 'Choose an expiration date in the future.' })
  const restriction = { status, reason: reason.trim(), expiresAt: expiry, setBy: req.user._id, setAt: new Date() }
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { $set: { commentRestriction: restriction }, $push: { commentRestrictionHistory: restriction } }, { new: true, runValidators: true }).select('commentRestriction')
    if (!user) return res.status(404).json({ error: 'User not found.' })
    return res.json({ commentRestriction: user.commentRestriction })
  } catch { return res.status(500).json({ error: 'Unable to update commenting access.' }) }
}

const newSignupFilter = (adminId, after, through) => ({
  _id: { $ne: adminId }, signupNoticeAt: { $gt: after || new Date(0), ...(through ? { $lte: through } : {}) },
})
export const unreadSignups = async (req, res) => {
  res.set('Cache-Control', 'private, no-store')
  try {
    const admin = await User.findById(req.user._id).select('+usersPageSeenAt').lean()
    if (!admin) return res.status(404).json({ error: 'Account not found.' })
    return res.json({ unreadCount: await User.countDocuments(newSignupFilter(req.user._id, admin.usersPageSeenAt)) })
  } catch { return res.status(500).json({ error: 'Unable to check new users.' }) }
}
export const visitUsersPage = async (req, res) => {
  res.set('Cache-Control', 'private, no-store')
  try {
    const through = new Date()
    const previous = await User.findByIdAndUpdate(req.user._id, { $max: { usersPageSeenAt: through } }, { new: false }).select('+usersPageSeenAt').lean()
    if (!previous) return res.status(404).json({ error: 'Account not found.' })
    const users = await User.find(newSignupFilter(req.user._id, previous.usersPageSeenAt, through)).select('_id').sort({ createdAt: -1, _id: -1 }).limit(24).lean()
    return res.json({ newUserIds: users.map(user => String(user._id)) })
  } catch { return res.status(500).json({ error: 'Unable to acknowledge new users.' }) }
}
