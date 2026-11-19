export const cropGeometry = ({ width, height, boxWidth, boxHeight, aspect, zoom = 1, offset = { x: 0, y: 0 } }) => {
  const frameWidth = Math.min(boxWidth, boxHeight * aspect)
  const frameHeight = frameWidth / aspect
  const scale = Math.max(frameWidth / width, frameHeight / height) * zoom
  const imageWidth = width * scale, imageHeight = height * scale
  const limitX = Math.max(0, (imageWidth - frameWidth) / 2)
  const limitY = Math.max(0, (imageHeight - frameHeight) / 2)
  const x = Math.max(-limitX, Math.min(limitX, offset.x))
  const y = Math.max(-limitY, Math.min(limitY, offset.y))
  return { frameWidth, frameHeight, imageWidth, imageHeight, x, y, source: {
    x: ((imageWidth - frameWidth) / 2 - x) / scale,
    y: ((imageHeight - frameHeight) / 2 - y) / scale,
    width: frameWidth / scale, height: frameHeight / scale,
  } }
}

export const exportCroppedImage = async (image, file, source) => {
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 2048 / source.width, 2048 / source.height)
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not prepare this crop.')
  context.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height)
  const type = file.type === 'image/jpeg' || file.type === 'image/gif' ? 'image/jpeg' : 'image/webp'
  const blob = await new Promise(resolve => canvas.toBlob(resolve, type, 0.92))
  if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('The cropped picture is too large. Try a tighter crop or a smaller image.')
  const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-cropped.${extension}`, { type: blob.type })
}
