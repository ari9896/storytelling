import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { checkImageForGore, checkStoryImagesForGore } from './imageModeration.js'
import cloudinary from './cloudinary.js'
import { uploadProfilePic } from '../controllers/profile.controller.js'
import { createStory, updateStory } from '../controllers/story.controller.js'

const image = 'data:image/png;base64,aGVsbG8='
const safe = () => ({ status: 'success', gore: { classes: { very_bloody: 0.01, body_organ: 0.01, serious_injury: 0.01, corpse: 0.01 } } })
const response = data => ({ ok: true, json: async () => data })
let originalFetch, originalUpload, originalEnv
beforeEach(() => {
  originalFetch = globalThis.fetch
  originalUpload = cloudinary.uploader.upload
  originalEnv = { ...process.env }
  process.env.SIGHTENGINE_API_USER = 'test-user'
  process.env.SIGHTENGINE_API_SECRET = 'test-secret'
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'
  process.env.CLOUDINARY_API_KEY = 'test-key'
  process.env.CLOUDINARY_API_SECRET = 'test-secret'
})
afterEach(() => {
  globalThis.fetch = originalFetch
  cloudinary.uploader.upload = originalUpload
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]
  Object.assign(process.env, originalEnv)
})
const code = expected => error => error.code === expected

test('uploads bytes privately and requests only the gore model; nudity is not a rejection criterion', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.sightengine.com/1.0/check.json')
    assert.equal(options.method, 'POST')
    assert.equal(options.body.get('models'), 'gore-2.0')
    assert.equal(options.body.get('api_user'), 'test-user')
    assert.equal(options.body.get('api_secret'), 'test-secret')
    assert.equal(await options.body.get('media').text(), 'hello')
    assert.equal(options.body.get('media').type, 'image/png')
    assert.ok(options.signal instanceof AbortSignal)
    return response({ ...safe(), nudity: { sexual_activity: 1 } })
  }
  await checkImageForGore(image)
})

test('each graphic category is blocked at the threshold, regardless of real/fake/animated type', async () => {
  for (const category of ['very_bloody', 'body_organ', 'serious_injury', 'corpse']) {
    const result = safe()
    result.gore.classes[category] = 0.7
    result.gore.type = { animated: 1 }
    globalThis.fetch = async () => response(result)
    await assert.rejects(checkImageForGore(image), error => error.status === 422 && error.code === 'IMAGE_GORE_DETECTED')
  }
})

test('minor injury, skulls, and general horror do not trigger the graphic-only policy', async () => {
  const result = safe()
  Object.assign(result.gore.classes, { slightly_bloody: 1, superficial_injury: 1, skull: 1, other: 1 })
  result.gore.prob = 1
  globalThis.fetch = async () => response(result)
  await checkImageForGore(image)
})

test('missing credentials block new pictures without sending a request', async () => {
  delete process.env.SIGHTENGINE_API_SECRET
  globalThis.fetch = () => assert.fail('should not call provider')
  await assert.rejects(checkImageForGore(image), code('IMAGE_MODERATION_NOT_CONFIGURED'))
})

test('provider errors, rate limits, network failures, and malformed scores fail closed', async () => {
  for (const implementation of [
    async () => ({ ok: false }),
    async () => { throw new Error('private upstream detail') },
    async () => { throw new DOMException('timed out', 'TimeoutError') },
    async () => ({ ok: true, json: async () => { throw new SyntaxError() } }),
    async () => response({ status: 'failure', error: { message: 'private upstream detail' } }),
    async () => response({ status: 'success', gore: {} }),
    async () => response({ ...safe(), gore: { classes: { ...safe().gore.classes, corpse: '0.9' } } }),
    async () => response({ ...safe(), gore: { classes: { ...safe().gore.classes, corpse: 2 } } }),
  ]) {
    globalThis.fetch = implementation
    await assert.rejects(checkImageForGore(image), error => error.status === 503 && error.code === 'IMAGE_MODERATION_UNAVAILABLE' && !error.message.includes('private'))
  }
})

test('invalid or oversized images never reach the provider', async () => {
  globalThis.fetch = () => assert.fail('should not call provider')
  for (const input of ['https://example.com/image.png', 'data:text/plain;base64,aGVsbG8=', `data:image/png;base64,${Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64')}`]) {
    await assert.rejects(checkImageForGore(input), code('INVALID_IMAGE'))
  }
})

test('existing images and text-only edits need no moderation call or credentials', async () => {
  delete process.env.SIGHTENGINE_API_SECRET
  globalThis.fetch = () => assert.fail('should not call provider')
  await checkStoryImagesForGore({ thumbnail: { publicId: 'existing-cover' }, chapters: [{ images: [{ publicId: 'existing-picture' }] }] })
})

const resMock = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this }, json(body) { this.body = body; return this } })
const storyBody = () => ({ title: 'Test story', version: 0, chapters: [{ title: 'Chapter one', text: 'Story text', images: [{ data: image }] }] })

test('profile uploads expose a useful rejection and do not upload rejected pictures', async () => {
  let uploads = 0
  cloudinary.uploader.upload = async () => { uploads++; throw new Error('unexpected upload') }
  const result = safe(); result.gore.classes.serious_injury = 0.99
  globalThis.fetch = async () => response(result)
  const res = resMock()
  await uploadProfilePic({ body: { image }, user: { _id: 'user' } }, res)
  assert.equal(res.statusCode, 422)
  assert.equal(res.body.code, 'IMAGE_GORE_DETECTED')
  assert.equal(uploads, 0)
})

test('story creation checks the thumbnail and all new chapter pictures before uploading any', async () => {
  let uploads = 0, checks = 0
  cloudinary.uploader.upload = async () => { uploads++; throw new Error('unexpected upload') }
  globalThis.fetch = async () => {
    checks++
    const result = safe()
    if (checks === 3) result.gore.classes.very_bloody = 0.99
    return response(result)
  }
  const body = storyBody()
  body.thumbnail = { data: image }
  body.chapters[0].images.push({ data: image })
  const res = resMock()
  await createStory({ body, user: { _id: 'user' } }, res)
  assert.equal(checks, 3)
  assert.equal(uploads, 0)
  assert.equal(res.statusCode, 422)
  assert.match(res.body.error, /Chapter 1, picture 2/)
})

test('story editing screens new pictures and leaves existing images untouched on failure', async () => {
  let uploads = 0
  cloudinary.uploader.upload = async () => { uploads++; throw new Error('unexpected upload') }
  const result = safe(); result.gore.classes.corpse = 0.99
  globalThis.fetch = async () => response(result)
  const body = storyBody()
  body.chapters[0].id = 'chapter-one'
  body.chapters[0].images.unshift({ publicId: 'old-picture' })
  const res = resMock()
  await updateStory({ body, user: { _id: 'user' }, ownedStory: { __v: 0, slug: 'test', chapters: [{ _id: 'chapter-one', images: [{ publicId: 'old-picture' }] }] } }, res)
  assert.equal(uploads, 0)
  assert.equal(res.statusCode, 422)
  assert.equal(res.body.code, 'IMAGE_GORE_DETECTED')
})
