import { api } from './api.js'

const pending = new Map()
// Serialize writes for the same reader/story, including across reader remounts.
export const saveReadingPosition = (userId, storyId, chapterId, paragraphIndex = 0) => {
  const key = `${userId}:${storyId}`
  const request = (pending.get(key) || Promise.resolve()).catch(() => {}).then(() => api.patch(`/stories/${encodeURIComponent(storyId)}/progress`, { chapterId, paragraphIndex }))
  pending.set(key, request)
  const cleanup = () => { if (pending.get(key) === request) pending.delete(key) }
  request.then(cleanup, cleanup)
  return request
}
