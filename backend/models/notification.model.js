import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['reply', 'new_chapter', 'story_invite'], default: 'reply' },
  storyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Story', required: true },
  chapterId: { type: mongoose.Schema.Types.ObjectId, required: function () { return this.type !== 'story_invite' } },
  commentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', required: function () { return this.type === 'reply' } },
  readAt: { type: Date, default: null },
}, { timestamps: true })
notificationSchema.index({ recipient: 1, createdAt: -1 })
notificationSchema.index({ recipient: 1, commentId: 1 }, { unique: true, name: 'recipient_reply_unique', partialFilterExpression: { type: 'reply' } })
notificationSchema.index({ recipient: 1, chapterId: 1 }, { unique: true, name: 'recipient_chapter_unique', partialFilterExpression: { type: 'new_chapter' } })
notificationSchema.index({ recipient: 1, storyId: 1 }, { unique: true, name: 'recipient_story_invite_pending_unique', partialFilterExpression: { type: 'story_invite', readAt: null } })
export default mongoose.model('Notification', notificationSchema)
