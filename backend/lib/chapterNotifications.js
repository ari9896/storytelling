import Notification from '../models/notification.model.js'

let indexSetup
export const ensureChapterNotificationIndexes = () => {
  if (!indexSetup) indexSetup = (async () => {
    await Notification.createIndexes()
    try { await Notification.collection.dropIndex('recipient_1_commentId_1') }
    catch (error) { if (error.code !== 27 && error.codeName !== 'IndexNotFound') throw error }
  })().catch(error => { indexSetup = null; throw error })
  return indexSetup
}

export const notifyNewChapters = async (previousCount, story, actor, session) => {
  const added = Array.isArray(previousCount) ? story.chapters.filter(chapter => !previousCount.includes(String(chapter._id))) : story.chapters.slice(previousCount)
  if (!added.length) return
  const readers = new Map([...story.chapters, ...(story.archivedChapters || [])].flatMap(chapter => chapter.commentedUserIds || []).map(id => [String(id), id]))
  readers.delete(String(actor._id))
  const operations = []
  for (const chapter of added) for (const recipient of readers.values()) operations.push({ updateOne: {
    filter: { type: 'new_chapter', recipient, chapterId: chapter._id },
    update: { $setOnInsert: { type: 'new_chapter', recipient, actor: actor._id, storyId: story._id, chapterId: chapter._id, readAt: null } },
    upsert: true,
  } })
  if (operations.length) await Notification.bulkWrite(operations, { session })
}
