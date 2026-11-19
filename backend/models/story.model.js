import mongoose from 'mongoose'

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },
  alt: { type: String, default: '' },
  explanation: { type: String, default: '', maxlength: 2000 },
  publicId: { type: String, default: null },
}, { _id: false })

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  profilePic: { type: String, default: null },
  body: { type: String, required: true, maxlength: 1000 },
  parentId: { type: mongoose.Schema.Types.ObjectId, default: null },
  depth: { type: Number, min: 0, max: 2, default: 0 },
}, { timestamps: true })

const chapterSchema = new mongoose.Schema({
  deletedAt: { type: Date, default: null },
  title: { type: String, required: true, trim: true },
  number: { type: Number, required: true, min: 1, validate: Number.isInteger },
  text: { type: String, required: true },
  images: { type: [imageSchema], default: [], validate: { validator: images => images.length <= 5, message: 'A chapter can have up to five images.' } },
  // Read legacy embedded comments for automatic migration; new posts use Comment.
  comments: { type: [commentSchema], default: undefined },
  // Add the authenticated author's ID with $addToSet when a comment is saved.
  commentedUserIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
}, { timestamps: true })

const storySchema = new mongoose.Schema({
  deletedAt: { type: Date, default: null, index: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, immutable: true, index: true },
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true },
  plannedChapterCount: {
    type: Number, default: null, min: 1, max: 10000,
    validate: { validator: function (value) { return value == null || (Number.isInteger(value) && value >= this.chapters.length) }, message: 'Planned chapter count must be a whole number at least as large as the available chapter count.' },
  },
  description: { type: String, default: '' },
  thumbnail: { type: imageSchema, default: null },
  authorNote: {
    type: new mongoose.Schema({ title: { type: String, default: 'A note from the author' }, text: { type: String, required: true } }, { _id: false }),
    default: null,
  },
  storytellerNote: { type: String, default: '' },
  archivedChapters: { type: [chapterSchema], default: [] },
  chapters: {
    type: [chapterSchema],
    default: [],
    validate: {
      validator: chapters => chapters.every((chapter, index) => chapter.number === index + 1),
      message: 'Chapters must be ordered and numbered consecutively starting at 1.',
    },
  },
}, { timestamps: true })

export default mongoose.model('Story', storySchema)
