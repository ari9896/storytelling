import mongoose from 'mongoose'
import cloudinary from './cloudinary.js'

export const validateCharacterSheets = (characters, existing = [], allowExisting = false) => {
  if (characters === undefined) return { bytes: 0 }
  if (!Array.isArray(characters) || characters.length > 100) return { error: 'Add up to 100 character sheets.' }
  const byId = new Map(existing.map(character => [String(character._id), character]))
  const seen = new Set()
  let bytes = 0
  for (const character of characters) {
    if (!character || typeof character.name !== 'string' || character.name.length > 200 || typeof character.notes !== 'string' || character.notes.length > 100000) return { error: 'Character names can be up to 200 characters and notes up to 100,000 characters.' }
    if (character.status !== undefined || (character.visibility !== undefined && character.visibility !== 'private')) return { error: 'Character sheets are always private and cannot be published.' }
    if (character.id !== undefined) {
      if (!allowExisting || typeof character.id !== 'string' || !byId.has(character.id) || seen.has(character.id)) return { error: 'Each saved character must belong to this story and appear only once.' }
      seen.add(character.id)
    }
    if (!Array.isArray(character.images) || character.images.length > 5) return { error: 'Each character can have up to five pictures.' }
    for (const image of character.images) {
      if (!image || (image.explanation !== undefined && (typeof image.explanation !== 'string' || image.explanation.length > 2000))) return { error: 'Character image explanations can be up to 2,000 characters.' }
      if (!image.data) {
        if (!allowExisting || !byId.get(character.id)?.images.some(original => original.publicId === image.publicId)) return { error: 'An existing picture does not belong to this character.' }
      } else {
        if (typeof image.data !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.data)) return { error: 'Choose PNG, JPEG, WebP, or GIF character pictures.' }
        const size = Buffer.byteLength(image.data.split(',')[1], 'base64')
        if (!size || size > 5 * 1024 * 1024) return { error: 'Each character picture must be 5 MB or smaller.' }
        bytes += size
      }
    }
  }
  return { bytes }
}

export const prepareCharacterSheets = async (characters, existing, slug, uploaded) => {
  const byId = new Map(existing.map(character => [String(character._id), character]))
  const result = []
  for (const character of characters) {
    const images = []
    for (const image of character.images) {
      if (!image.data) {
        const original = byId.get(character.id).images.find(picture => picture.publicId === image.publicId)
        images.push({ ...(original.toObject ? original.toObject() : original), explanation: image.explanation ?? original.explanation ?? '' })
      } else {
        const asset = await cloudinary.uploader.upload(image.data, { folder: `storytelling/stories/${slug}/characters`, type: 'authenticated', resource_type: 'image', allowed_formats: ['png', 'jpg', 'jpeg', 'webp', 'gif'] })
        uploaded.push({ publicId: asset.public_id, type: 'authenticated' })
        images.push({ url: asset.secure_url, publicId: asset.public_id, format: asset.format || null, version: asset.version || null, alt: '', explanation: image.explanation || '' })
      }
    }
    result.push({ _id: character.id ? byId.get(character.id)._id : new mongoose.Types.ObjectId(), name: character.name.trim(), notes: character.notes, images, createdAt: byId.get(character.id)?.createdAt || new Date(), updatedAt: new Date() })
  }
  return result
}

export const editorCharacters = story => (story.characters || []).map(character => ({
  id: String(character._id), name: character.name, notes: character.notes,
  images: character.images.map(image => ({ publicId: image.publicId, alt: image.alt, explanation: image.explanation || '',
    url: cloudinary.url(image.publicId, { type: 'authenticated', resource_type: 'image', secure: true, sign_url: true,
      ...(image.format ? { format: image.format } : {}), ...(image.version ? { version: image.version } : {}),
    }),
  })),
}))

export const cleanupStoryUploads = uploaded => Promise.allSettled(uploaded.map(asset => typeof asset === 'string'
  ? cloudinary.uploader.destroy(asset)
  : cloudinary.uploader.destroy(asset.publicId, { type: asset.type, resource_type: 'image' })))
