import { effectiveCommentRestriction } from '../lib/commentRestriction.js'
import mongoose from 'mongoose'
import { signupIp } from '../lib/signupIp.js'
import User from '../models/user.model.js'
import validator from 'validator'
import bcrypt from 'bcryptjs'
import { AUTH_COOKIE, cookieOptions, generateToken } from '../lib/utils.js'

const publicUser = (user) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  role: user.role === 'user' ? 'reader' : user.role,
  showMatureStories: user.showMatureStories === true,
  allowStoryInvitations: user.allowStoryInvitations !== false,
  profilePic: user.profilePic,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  commentRestriction: effectiveCommentRestriction(user),
})

export const signup = async (req, res) => {
  if (!process.env.ACCESS_TOKEN_SECRET) {
    return res.status(503).json({ message: 'Authentication is not configured.' })
  }
  const { username, email, password } = req.body || {}
  if (![username, email, password].every(value => typeof value === 'string' && value.length > 0)) {
    return res.status(400).json({ error: 'All fields must be filled.' })
  }
  if (username.length < 3 || username.length > 20 || !validator.isAlphanumeric(username)) {
    return res.status(400).json({ error: 'Username must be 3–20 characters and contain only letters and numbers.' })
  }
  const normalizedEmail = email.trim().toLowerCase()
  if (!validator.isEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Email is not valid.' })
  }
  if (!validator.isStrongPassword(password, {
    minLength: 8, minLowercase: 1, minUppercase: 0, minNumbers: 1, minSymbols: 0,
  })) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and contain a lowercase letter and a number.' })
  }

  try {
    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { username }] })
    if (existingUser) return res.status(400).json({ error: 'Email or username already in use.' })
    const hash = await bcrypt.hash(password, 10)
    const user = await User.create({ username, email: normalizedEmail, password: hash, signupIp: signupIp(req), signupNoticeAt: new Date() })
    return res.status(201).json(publicUser(user))
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: 'Email or username already in use.' })
    console.error('Error in signup controller:', error.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

export const login = async (req, res) => {
  const { identifier, password } = req.body || {}
  if (![identifier, password].every(value => typeof value === 'string' && value.length > 0)) {
    return res.status(400).json({ message: 'All fields required.' })
  }
  if (!process.env.ACCESS_TOKEN_SECRET) {
    return res.status(503).json({ message: 'Authentication is not configured.' })
  }

  try {
    const normalizedIdentifier = identifier.trim()
    const query = validator.isEmail(normalizedIdentifier)
      ? { email: normalizedIdentifier.toLowerCase() }
      : { username: normalizedIdentifier }
    const user = await User.findOne(query).select('+password')
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(400).json({ message: 'Invalid credentials.' })
    }
    generateToken(user._id, res)
    return res.status(200).json(publicUser(user))
  } catch (error) {
    console.error('Error in login controller:', error.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

export const logout = (_req, res) => {
  res.clearCookie(AUTH_COOKIE, cookieOptions())
  return res.status(200).json({ message: 'Logged out successfully.' })
}

export const getProfile = (req, res) => res.status(200).json(publicUser(req.user))

export const updateUsername = async (req, res) => {
  const { username } = req.body || {}
  if (typeof username !== 'string' || username.length < 3 || username.length > 20 || !validator.isAlphanumeric(username)) {
    return res.status(400).json({ error: 'Username must be 3–20 characters and contain only letters and numbers.' })
  }
  try {
    const taken = await User.findOne({ username, _id: { $ne: req.user._id } })
    if (taken) return res.status(409).json({ error: 'That username is already in use.' })
    const user = await User.findByIdAndUpdate(req.user._id, { $set: { username } }, { new: true, runValidators: true })
    if (!user) return res.status(404).json({ error: 'User not found.' })
    return res.json({ username: user.username })
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'That username is already in use.' })
    return res.status(500).json({ error: 'Unable to change username. Please try again.' })
  }
}

export const getPublicProfile = async (req, res) => {
  res.set('Cache-Control', 'private, no-store')
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid user ID.' })
  try {
    const user = await User.findById(req.params.id).select('_id username profilePic createdAt').lean()
    if (!user) return res.status(404).json({ error: 'This profile is no longer available.' })
    return res.json({ id: String(user._id), username: user.username, profilePic: user.profilePic || null, createdAt: user.createdAt })
  } catch { return res.status(500).json({ error: 'Unable to load this profile.' }) }
}

export const updatePreferences = async (req, res) => {
  if (!req.user?._id) return res.status(401).json({ error: 'Sign in to change your preferences.' })
  const updates = {}
  for (const key of ['showMatureStories', 'allowStoryInvitations']) {
    if (req.body && Object.hasOwn(req.body, key)) {
      if (typeof req.body[key] !== 'boolean') return res.status(400).json({ error: 'Choose on or off for your preference.' })
      updates[key] = req.body[key]
    }
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Choose a preference to update.' })
  try {
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true }).select(Object.keys(updates).join(' '))
    if (!user) return res.status(404).json({ error: 'Account no longer exists.' })
    res.set('Cache-Control', 'private, no-store')
    return res.json(Object.fromEntries(Object.keys(updates).map(key => [key, key === 'allowStoryInvitations' ? user[key] !== false : user[key] === true])))
  } catch { return res.status(500).json({ error: 'Unable to save your preference. Please try again.' }) }
}
