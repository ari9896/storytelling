import mongoose from 'mongoose'

// Public character profiles are embedded in their story and share its save/version boundary.
// The legacy notes field stores the introduction; archived characters remain private.
const characterImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  format: { type: String, default: null },
  version: { type: Number, default: null },
  alt: { type: String, default: '', maxlength: 500 },
  explanation: { type: String, default: '', maxlength: 2000 },
}, { _id: false })
const characterSchema = new mongoose.Schema({
  name: { type: String, default: '', trim: true, maxlength: 200 },
  notes: { type: String, default: '', maxlength: 100000 },
  images: { type: [characterImageSchema], default: [], validate: { validator: images => images.length <= 5, message: 'A character can have up to five pictures.' } },
  deletedAt: { type: Date, default: null },
}, { timestamps: true })
export default characterSchema
