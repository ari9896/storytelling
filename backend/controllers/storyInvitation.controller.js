import { hasPublishedChapters } from '../lib/chapterPublication.js'
import User from '../models/user.model.js'
import Notification from '../models/notification.model.js'
import { ensureChapterNotificationIndexes } from '../lib/chapterNotifications.js'
import { reserveStoryInvitation, releaseStoryInvitation } from '../lib/storyInvitations.js'

const ownsStory = req => req.user && req.ownedStory?.creatorId && String(req.user._id) === String(req.ownedStory.creatorId) && !req.ownedStory.deletedAt
const recipientFilter = (req, username) => ({ username, _id: { $ne: req.user._id }, allowStoryInvitations: { $ne: false },
})

export const searchInvitees = async (req, res) => {
  res.set('Cache-Control', 'private, no-store')
  if (!ownsStory(req)) return res.status(403).json({ error: 'Only the author can invite readers to this story.' })
  if (!hasPublishedChapters(req.ownedStory)) return res.status(400).json({ error: 'Publish the first chapter before inviting readers.' })
  const query = typeof req.query.q === 'string' ? req.query.q.trim().replace(/^@/, '') : ''
  if (query.length < 2) return res.json({ users: [] })
  if (!/^[a-zA-Z0-9]{2,20}$/.test(query)) return res.status(400).json({ error: 'Search using 2–20 letters or numbers.' })
  try {
    const users = await User.find(recipientFilter(req, { $regex: `^${query}`, $options: 'i' })).select('_id username profilePic').sort({ username: 1, _id: 1 }).limit(10).lean()
    return res.json({ users: users.map(user => ({ id: String(user._id), username: user.username, profilePic: user.profilePic || null })) })
  } catch { return res.status(500).json({ error: 'Unable to search readers. Please try again.' }) }
}

export const sendStoryInvitation = async (req, res) => {
  res.set('Cache-Control', 'private, no-store')
  if (!ownsStory(req)) return res.status(403).json({ error: 'Only the author can invite readers to this story.' })
  if (!hasPublishedChapters(req.ownedStory)) return res.status(400).json({ error: 'Publish the first chapter before inviting readers.' })
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().replace(/^@/, '') : ''
  if (!/^[a-zA-Z0-9]{3,20}$/.test(username)) return res.status(400).json({ error: 'Choose a reader by username.' })
  let reservation
  try {
    const recipient = await User.findOne(recipientFilter(req, username)).select('_id username')
    if (!recipient) return res.status(404).json({ error: 'This reader was not found or is not accepting invitations for this story.' })
    const scope = { type: 'story_invite', recipient: recipient._id, storyId: req.ownedStory._id, readAt: null }
    if (await Notification.exists(scope)) return res.json({ username: recipient.username, alreadySent: true })
    await ensureChapterNotificationIndexes()
    reservation = await reserveStoryInvitation(req.user._id)
    if (!reservation) return res.status(429).json({ error: 'You can send up to 20 story invitations in 24 hours. Please try again later.' })
    await Notification.create({ ...scope, actor: req.user._id })
    return res.status(201).json({ username: recipient.username, alreadySent: false })
  } catch (error) {
    if (reservation) await releaseStoryInvitation(req.user._id, reservation).catch(() => {})
    if (error.code === 11000) return res.json({ username, alreadySent: true })
    return res.status(500).json({ error: 'Unable to send this invitation. Please try again.' })
  }
}
