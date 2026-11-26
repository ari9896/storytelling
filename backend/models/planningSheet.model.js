import mongoose from 'mongoose'

// Events and threads are private story subdocuments, never reader chapters.
const planningSheetSchema = new mongoose.Schema({
  title: { type: String, default: '', trim: true, maxlength: 200 },
  text: { type: String, default: '', maxlength: 100000 },
  deletedAt: { type: Date, default: null },
}, { timestamps: true })
export default planningSheetSchema
