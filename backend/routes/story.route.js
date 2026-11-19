import { saveReadingProgress } from '../controllers/readingProgress.controller.js'
import { getDiscussion, postComment, softDeleteComment } from '../controllers/comment.controller.js'
import express from 'express'
import { protectRoute, adminRoute, optionalAuth } from '../middleware/auth.middleware.js'
import { createStory, listStories, getStory, requireStoryOwner, getStoryEditor, updateStory, softDeleteStory } from '../controllers/story.controller.js'

const router = express.Router()
router.get('/', listStories)
router.get('/:slug/discussion', protectRoute, getDiscussion)
router.get('/:slug/discussion/public', getDiscussion)
router.post('/:slug/chapters/:chapterId/comments', protectRoute, postComment)
router.delete('/:slug/chapters/:chapterId/comments/:commentId', protectRoute, adminRoute, softDeleteComment)
router.patch('/:slug/progress', protectRoute, saveReadingProgress)
router.get('/:slug/edit', protectRoute, requireStoryOwner, getStoryEditor)
router.put('/:slug', protectRoute, requireStoryOwner, express.json({ limit: '40mb' }), updateStory)
router.delete('/:slug', protectRoute, requireStoryOwner, softDeleteStory)
router.get('/:slug', optionalAuth, getStory)
router.post('/', protectRoute, adminRoute, express.json({ limit: '40mb' }), createStory)
router.use((error, _req, res, next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Story is too large. Reduce picture sizes and try again.' })
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid story data.' })
  return next(error)
})
export default router
