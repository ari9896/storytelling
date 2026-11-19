import mongoose from 'mongoose'
const readingProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  storyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Story', required: true },
  chapterId: { type: mongoose.Schema.Types.ObjectId, required: true },
  lastReadAt: { type: Date, required: true },
}, { timestamps: true })
readingProgressSchema.index({ userId: 1, storyId: 1 }, { unique: true })
export default mongoose.model('ReadingProgress', readingProgressSchema)
