import { listUsers, getUserDetails } from '../controllers/adminUser.controller.js'
import { uploadProfilePic } from '../controllers/profile.controller.js'
import express from 'express'
import { signup, login, logout, getProfile, updateUsername } from '../controllers/user.controller.js'
import { protectRoute, adminRoute } from '../middleware/auth.middleware.js'

const router = express.Router()

router.post('/signup', signup)
router.post('/login', login)
router.post('/logout', logout)
router.post('/profile-pic', protectRoute, express.json({ limit: '8mb' }), uploadProfilePic)
router.patch('/username', protectRoute, updateUsername)
router.get('/profile', protectRoute, getProfile)
router.get('/admin/users', protectRoute, adminRoute, listUsers)
router.get('/admin/users/:id', protectRoute, adminRoute, getUserDetails)

export default router
