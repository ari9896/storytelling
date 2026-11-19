import mongoose from 'mongoose'

const profilePhotoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, default: null },
  uploadedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
})

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, minlength: 3, maxlength: 20, match: /^[a-zA-Z0-9]+$/ },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  signupIp: { type: String, default: null, select: false },
  role: { type: String, enum: ['reader', 'admin'], default: 'reader' },
  profilePic: { type: String, default: null },
  profilePicPublicId: { type: String, default: null },
  profilePicHistory: { type: [profilePhotoSchema], default: [], select: false },
  profilePicUploadedAt: { type: Date, default: null },
}, { timestamps: true })

export default mongoose.model('User', userSchema)
