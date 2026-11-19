import { listUsers, getUserDetails, setCommentRestriction, unreadSignups, visitUsersPage } from '../controllers/adminUser.controller.js'
import { uploadProfilePic } from '../controllers/profile.controller.js'
import express from 'express'
import { signup, login, logout, getProfile, updateUsername, getPublicProfile } from '../controllers/user.controller.js'
import { protectRoute, adminRoute } from '../middleware/auth.middleware.js'

const router = express.Router()

router.post('/signup', signup)
router.post('/login', login)
router.post('/logout', logout)
router.post('/profile-pic', protectRoute, express.json({ limit: '8mb' }), uploadProfilePic)
router.patch('/username', protectRoute, updateUsername)
router.get('/profile', protectRoute, getProfile)
router.get('/public/:id', getPublicProfile)
router.get('/admin/users', protectRoute, adminRoute, listUsers)
router.get('/admin/users/unread', protectRoute, adminRoute, unreadSignups)
router.post('/admin/users/visit', protectRoute, adminRoute, visitUsersPage)
router.get('/admin/users/:id', protectRoute, adminRoute, getUserDetails)
router.patch('/admin/users/:id/comment-restriction', protectRoute, adminRoute, setCommentRestriction)

export default router
