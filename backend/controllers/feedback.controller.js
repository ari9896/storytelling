import mongoose from 'mongoose'
import validator from 'validator'
import Feedback from '../models/feedback.model.js'

export const submitFeedback = async (req, res) => {
  const { username, email, subject, message } = req.body || {}
  if (![username, email, subject, message].every(value => typeof value === 'string' && value.trim())) return res.status(400).json({ error: 'Please complete all fields.' })
  if (username.trim().length > 80 || email.trim().length > 254 || subject.trim().length > 200 || message.trim().length > 5000) return res.status(400).json({ error: 'One or more fields exceed the allowed length.' })
  if (!validator.isEmail(email.trim())) return res.status(400).json({ error: 'Enter a valid email address.' })
  try {
    await Feedback.create({ senderId: req.user._id, username: username.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() })
    return res.status(201).json({ message: 'Thank you! Your feedback has been sent.' })
  } catch { return res.status(500).json({ error: 'Unable to send feedback. Please try again.' }) }
}

export const feedbackUnread = async (req, res) => {
  res.set('Cache-Control', 'private, no-store')
  try { return res.json({ unreadCount: await Feedback.countDocuments({ readBy: { $ne: req.user._id } }) }) }
  catch { return res.status(500).json({ error: 'Unable to check feedback.' }) }
}

export const listFeedback = async (req, res) => {
  res.set('Cache-Control', 'private, no-store')
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1))
  try {
    const [items, total] = await Promise.all([Feedback.find().select('username email subject message createdAt readBy').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 24).limit(24).lean(), Feedback.countDocuments()])
    return res.json({ items: items.map(item => ({ id: String(item._id), username: item.username, email: item.email, subject: item.subject, preview: item.message.slice(0, 160), createdAt: item.createdAt, unread: !item.readBy.some(id => String(id) === String(req.user._id)) })), page, total, pages: Math.max(1, Math.ceil(total / 24)) })
  } catch { return res.status(500).json({ error: 'Unable to load feedback.' }) }
}

export const getFeedback = async (req, res) => {
  res.set('Cache-Control', 'private, no-store')
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid feedback ID.' })
  try {
    const item = await Feedback.findByIdAndUpdate(req.params.id, { $addToSet: { readBy: req.user._id } }, { new: true }).select('username email subject message createdAt senderId').lean()
    if (!item) return res.status(404).json({ error: 'Feedback not found.' })
    return res.json(item)
  } catch { return res.status(500).json({ error: 'Unable to open feedback.' }) }
}
