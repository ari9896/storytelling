import mongoose from 'mongoose'
const feedbackSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  username: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, trim: true, maxlength: 254 },
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  readBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
}, { timestamps: true })
feedbackSchema.index({ createdAt: -1, _id: -1 })
export default mongoose.model('Feedback', feedbackSchema)
