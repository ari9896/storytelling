import express from 'express'
import { protectRoute, adminRoute } from '../middleware/auth.middleware.js'
import { submitFeedback, feedbackUnread, listFeedback, getFeedback } from '../controllers/feedback.controller.js'
const router = express.Router()
router.use(protectRoute)
router.post('/', submitFeedback)
router.get('/unread', adminRoute, feedbackUnread)
router.get('/', adminRoute, listFeedback)
router.get('/:id', adminRoute, getFeedback)
export default router
