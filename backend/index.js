import { configureProxyTrust } from './lib/signupIp.js'
import { serveFrontend } from './lib/serveFrontend.js'
import feedbackRouter from './routes/feedback.route.js'
import notificationRouter from './routes/notification.route.js'
import storyRouter from './routes/story.route.js'
import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import mongoose from 'mongoose'
import { connectDB } from './lib/connectDB.js'
import userRouter from './routes/user.route.js'

const app = express()
configureProxyTrust(app)
const PORT = process.env.PORT || 5016

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))
app.use((req, res, next) => {
  if (/^\/api\/user\/profile-pic\/?$/.test(req.path) || (req.method === 'POST' && /^\/api\/stories\/?$/.test(req.path)) || (req.method === 'PUT' && /^\/api\/stories\/[^/]+\/?$/.test(req.path))) return next()
  return express.json()(req, res, next)
})
app.use(cookieParser())

if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`)
    console.log('User agent:', req.headers['user-agent'])
    console.log('Cookie names:', Object.keys(req.cookies || {}))
    next()
  })
}

app.use('/api/user', userRouter)
app.use('/api/feedback', feedbackRouter)
app.use('/api/stories', storyRouter)
app.use('/api/notifications', notificationRouter)

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'not configured',
  })
})

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }))

if (process.env.NODE_ENV === 'production') serveFrontend(app)

app.listen(PORT, '0.0.0.0', () => {
  connectDB()
  console.log('Storytelling is running on port:', PORT)
})
