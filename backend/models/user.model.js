import mongoose from 'mongoose'

const profilePhotoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, default: null },
  uploadedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
})

const restrictionSchema = new mongoose.Schema({
  status: { type: String, enum: ['none', 'temporary', 'indefinite'], default: 'none' },
  reason: { type: String, default: '', maxlength: 500 },
  expiresAt: { type: Date, default: null },
  setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  setAt: { type: Date, default: null },
}, { _id: false })

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, minlength: 3, maxlength: 20, match: /^[a-zA-Z0-9]+$/ },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  commentRestriction: { type: restrictionSchema, default: () => ({ status: 'none' }) },
  commentRestrictionHistory: { type: [restrictionSchema], default: [], select: false },
  signupNoticeAt: { type: Date, default: null, select: false, index: true },
  usersPageSeenAt: { type: Date, default: null, select: false },
  signupIp: { type: String, default: null, select: false },
  role: { type: String, enum: ['reader', 'writer', 'admin'], default: 'reader' },
  showMatureStories: { type: Boolean, default: false },
  allowStoryInvitations: { type: Boolean, default: true },
  storyInviteRate: { type: [new mongoose.Schema({ requestId: String, at: Date }, { _id: false })], default: [], select: false },
  profilePic: { type: String, default: null },
  profilePicPublicId: { type: String, default: null },
  profilePicHistory: { type: [profilePhotoSchema], default: [], select: false },
  profilePicUploadedAt: { type: Date, default: null },
}, { timestamps: true })

export default mongoose.model('User', userSchema)
