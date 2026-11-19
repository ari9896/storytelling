import mongoose from 'mongoose'
import cloudinary from '../lib/cloudinary.js'
import User from '../models/user.model.js'
import { checkImageForGore, ImageModerationError } from '../lib/imageModeration.js'

export const nextProfilePhotoHistory = (user, uploaded, now) => {
  const history = (user.profilePicHistory || []).map(photo => photo.toObject ? photo.toObject() : { ...photo })
  // Preserve the currently saved picture for accounts created before history was introduced.
  if (user.profilePic && !history.some(photo => photo.url === user.profilePic)) {
    history.push({ url: user.profilePic, publicId: user.profilePicPublicId || null, uploadedAt: user.profilePicUploadedAt || null, deletedAt: now })
  }
  for (const photo of history) if (!photo.deletedAt) photo.deletedAt = now
  history.push({ url: uploaded.secure_url, publicId: uploaded.public_id, uploadedAt: now, deletedAt: null })
  return history
}

export const uploadProfilePic = async (req, res) => {
  const { image } = req.body || {}
  if (typeof image !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) {
    return res.status(400).json({ error: 'Choose a PNG, JPEG, WebP, or GIF image.' })
  }
  if (Buffer.byteLength(image.split(',')[1], 'base64') > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Choose an image no larger than 5 MB.' })
  }
  if (!['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every(key => process.env[key]?.trim())) {
    return res.status(503).json({ error: 'Profile uploads are not configured. Set the Cloudinary credentials on the server.' })
  }

  let uploaded
  let committed = false
  try {
    await checkImageForGore(image)
    uploaded = await cloudinary.uploader.upload(image, {
      folder: 'storytelling/profile-pictures',
      resource_type: 'image',
      allowed_formats: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
      transformation: [{ width: 512, height: 512, crop: 'limit' }],
    })
    let user
    await mongoose.connection.transaction(async session => {
      const current = await User.findById(req.user._id).select('+profilePicHistory').session(session)
      if (!current) { const error = new Error('User not found.'); error.status = 404; throw error }
      const now = new Date()
      user = await User.findByIdAndUpdate(req.user._id, { $set: {
        profilePic: uploaded.secure_url, profilePicPublicId: uploaded.public_id, profilePicUploadedAt: now,
        profilePicHistory: nextProfilePhotoHistory(current, uploaded, now),
      } }, { new: true, runValidators: true, session })
      if (!user) throw new Error('User no longer exists.')
    })
    committed = true
    return res.status(200).json({ profilePic: user.profilePic })
  } catch (error) {
    // Clean up only an upload that was never saved; historical profile pictures are never destroyed.
    if (uploaded && !committed) await cloudinary.uploader.destroy(uploaded.public_id).catch(() => {})
    if (error instanceof ImageModerationError) return res.status(error.status).json({ error: error.message, code: error.code })
    return res.status(error.status || 500).json({ error: error.status === 404 ? 'User not found.' : 'Image upload failed. Please try again.' })
  }
}
