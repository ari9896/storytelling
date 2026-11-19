import mongoose from 'mongoose'
import Comment from '../models/comment.model.js'
import Story from '../models/story.model.js'

export const legacyCommentOperations = story => story.chapters.flatMap(chapter =>
  (chapter.comments || []).map(comment => ({ updateOne: {
    filter: { _id: comment._id },
    update: { $setOnInsert: {
      _id: comment._id, storyId: story._id, chapterId: chapter._id,
      author: comment.author, authorName: comment.authorName, profilePic: comment.profilePic,
      body: comment.body, parentId: comment.parentId || null, depth: comment.depth || 0,
      createdAt: comment.createdAt, updatedAt: comment.updatedAt,
    } }, upsert: true, timestamps: false,
  } })))

// Copy original IDs first, then remove embedded copies in the same transaction.
// Upserts make this safe to retry without duplicating discussions or breaking replies.
export const migrateStoryComments = async (story, session) => {
  const operations = legacyCommentOperations(story)
  if (!operations.length) return
  await Comment.bulkWrite(operations, { session })
  await Story.updateOne({ _id: story._id }, { $unset: { 'chapters.$[].comments': '' } }, { session })
}

export const ensureCommentMigration = async story => {
  if (!legacyCommentOperations(story).length) return
  await mongoose.connection.transaction(async session => {
    const fresh = await Story.findById(story._id).session(session)
    if (fresh) await migrateStoryComments(fresh, session)
  })
}
