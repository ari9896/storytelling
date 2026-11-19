// Sightengine gore-2.0: https://sightengine.com/docs/gore-disgusting-horrific-content-detection
// Check graphic categories only; minor injuries, nudity, and general horror are not blocked.
const graphicClasses = ['very_bloody', 'body_organ', 'serious_injury', 'corpse']
const rejectionThreshold = 0.7

export class ImageModerationError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ImageModerationError'
    this.status = status
    this.code = code
  }
}

const unavailable = () => new ImageModerationError(
  'Image safety checks are temporarily unavailable. Please try again later.', 503, 'IMAGE_MODERATION_UNAVAILABLE',
)

export const checkImageForGore = async image => {
  const apiUser = process.env.SIGHTENGINE_API_USER?.trim()
  const apiSecret = process.env.SIGHTENGINE_API_SECRET?.trim()
  if (!apiUser || !apiSecret) throw new ImageModerationError(
    'Image uploads are not configured. Set the Sightengine credentials on the server.', 503, 'IMAGE_MODERATION_NOT_CONFIGURED',
  )
  const match = typeof image === 'string' && image.match(/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!match) throw new ImageModerationError('Choose a PNG, JPEG, WebP, or GIF image.', 400, 'INVALID_IMAGE')
  const bytes = Buffer.from(match[2], 'base64')
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new ImageModerationError('Choose an image no larger than 5 MB.', 400, 'INVALID_IMAGE')
  const body = new FormData()
  body.set('api_user', apiUser)
  body.set('api_secret', apiSecret)
  body.set('models', 'gore-2.0')
  body.set('media', new Blob([bytes], { type: `image/${match[1]}` }), `upload.${match[1]}`)
  let result
  try {
    const response = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST', body, signal: AbortSignal.timeout(15000), redirect: 'error',
    })
    if (!response.ok) throw unavailable()
    result = await response.json()
  } catch {
    // Never expose upstream errors, credentials, or image data to clients/logs.
    throw unavailable()
  }
  const scores = graphicClasses.map(key => result?.gore?.classes?.[key])
  if (result?.status !== 'success' || scores.some(score => !Number.isFinite(score) || score < 0 || score > 1)) throw unavailable()
  if (scores.some(score => score >= rejectionThreshold)) throw new ImageModerationError(
    'This image could not be uploaded because it may contain graphic gore. Please choose another picture.', 422, 'IMAGE_GORE_DETECTED',
  )
}

export const checkStoryImagesForGore = async body => {
  if (body.thumbnail?.data) await checkImageForGore(body.thumbnail.data)
  for (const [chapterIndex, chapter] of body.chapters.entries()) {
    for (const [imageIndex, image] of chapter.images.entries()) {
      if (!image.data) continue
      try { await checkImageForGore(image.data) } catch (error) {
        if (error instanceof ImageModerationError && error.code === 'IMAGE_GORE_DETECTED') {
          error.message = `Chapter ${chapterIndex + 1}, picture ${imageIndex + 1}: ${error.message}`
        }
        throw error
      }
    }
  }
}
