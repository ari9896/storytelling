import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import User from '../models/user.model.js'
import { AUTH_COOKIE } from '../lib/utils.js'

export const protectRoute = async (req, res, next) => {
  const token = req.cookies?.[AUTH_COOKIE]
  if (!token) return res.status(401).json({ message: 'Unauthorized - No token provided.' })
  if (!process.env.ACCESS_TOKEN_SECRET) {
    return res.status(503).json({ message: 'Authentication is not configured.' })
  }

  let decoded
  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    if (!mongoose.isValidObjectId(decoded.userId)) throw new Error('Invalid user ID')
  } catch {
    return res.status(401).json({ message: 'Unauthorized - Invalid or expired access token.' })
  }

  try {
    const user = await User.findById(decoded.userId)
    if (!user) return res.status(401).json({ message: 'User not found.' })
    req.user = user
    return next()
  } catch (error) {
    console.error('Error in protectRoute:', error.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

export const adminRoute = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' })
  return next()
}

export const optionalAuth = async (req, res, next) => {
  const token = req.cookies?.[AUTH_COOKIE]
  if (!token || !process.env.ACCESS_TOKEN_SECRET) return next()
  let decoded
  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    if (!mongoose.isValidObjectId(decoded.userId)) return next()
  } catch { return next() }
  try {
    req.user = await User.findById(decoded.userId)
    return next()
  } catch { return res.status(500).json({ error: 'Unable to check reading access.' }) }
}

export const writerRoute = (req, res, next) => {
  if (!['writer', 'admin'].includes(req.user?.role)) return res.status(403).json({ message: 'Writer or admin access required to upload stories.' })
  return next()
}
