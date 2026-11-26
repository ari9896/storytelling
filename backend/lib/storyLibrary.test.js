import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import Story from '../models/story.model.js'
import { listStories, listMyStories } from '../controllers/story.controller.js'

const originalFind = Story.find
afterEach(() => { Story.find = originalFind })
const response = () => ({ code: 200, headers: {}, set(key, value) { this.headers[key] = value; return this }, status(code) { this.code = code; return this }, json(data) { this.data = data; return this } })

test('library resolves current author username and exposes no private account fields', async () => {
  let username = 'BeforeRename'
  Story.find = () => ({
    select(fields) { assert.ok(fields.includes('creatorId')); return this },
    populate(path, fields) { assert.equal(path, 'creatorId'); assert.equal(fields, 'username'); return this },
    sort() { return this },
    lean: async () => [{ slug: 'test', title: 'Test', creatorId: { username, email: 'private@example.com' } }, { slug: 'legacy', title: 'Legacy' }],
  })
  for (const name of ['BeforeRename', 'AfterRename']) {
    username = name
    const res = response(); await listStories({}, res)
    assert.equal(res.code, 200)
    assert.equal(res.data[0].authorUsername, name)
    assert.equal(res.data[1].authorUsername, null)
    assert.equal(JSON.stringify(res.data).includes('private@example.com'), false)
  }
})

test('my stories restricts results to the signed-in owner and excludes deleted stories', async () => {
  Story.find = filter => {
    assert.equal(filter.creatorId, 'signed-in-user')
    assert.equal(filter.deletedAt, null)
    assert.ok(filter.slug.$nin)
    return {
      select(fields) { assert.equal(fields, 'title slug thumbnail contentRating chapters.status'); return this },
      sort() { return this },
      lean: async () => [{ slug: 'mixed', title: 'My story', chapters: [{ status: 'published', text: 'private text' }, { status: 'draft' }], characters: [{ notes: 'secret' }] }, { slug: 'draft', title: 'New idea', chapters: [{ status: 'draft' }] }],
    }
  }
  const res = response(); await listMyStories({ user: { _id: 'signed-in-user' }, query: { creatorId: 'someone-else' } }, res)
  assert.equal(res.code, 200)
  assert.equal(res.headers['Cache-Control'], 'private, no-store')
  assert.equal(res.data.length, 2)
  assert.equal(res.data[0].publishedChapterCount, 1)
  assert.equal(res.data[0].draftChapterCount, 1)
  assert.equal(res.data[1].publishedChapterCount, 0)
  assert.equal(JSON.stringify(res.data).includes('private text'), false)
  assert.equal(JSON.stringify(res.data).includes('secret'), false)
})

test('my stories returns an empty collection when the user has no stories', async () => {
  Story.find = () => ({ select() { return this }, sort() { return this }, lean: async () => [] })
  const res = response(); await listMyStories({ user: { _id: 'owner' } }, res)
  assert.deepEqual(res.data, [])
})
