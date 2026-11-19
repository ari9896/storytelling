import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  storyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Story', required: true, immutable: true },
  chapterId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null, immutable: true },
  authorName: { type: String, required: true },
  profilePic: { type: String, default: null },
  deletionMode: { type: String, enum: ['notice', 'hidden'], default: 'notice' },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  body: { type: String, required: true, trim: true, maxlength: 1000 },
  depth: { type: Number, required: true, default: 0, min: 0, max: 2, validate: Number.isInteger },
}, { timestamps: true })

commentSchema.index({ storyId: 1, chapterId: 1, createdAt: 1 })
commentSchema.index({ parentId: 1 })
commentSchema.index({ author: 1, storyId: 1, chapterId: 1 })

export default mongoose.model('Comment', commentSchema)
