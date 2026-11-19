import express from 'express'
import { protectRoute } from '../middleware/auth.middleware.js'
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../controllers/notification.controller.js'
const router = express.Router()
router.use(protectRoute)
router.get('/', listNotifications)
router.patch('/read-all', markAllNotificationsRead)
router.patch('/:id/read', markNotificationRead)
export default router
