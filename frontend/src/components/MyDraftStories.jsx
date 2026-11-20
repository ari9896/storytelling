import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth.js'
import { api, authError } from '../lib/api.js'

const MyDraftStories = () => {
  const { user, loading } = useAuth()
  const accountId = user?._id
  const [result, setResult] = useState(null)
  useEffect(() => {
    if (loading || !accountId) return undefined
    let active = true
    api.get('/stories/drafts').then(({ data }) => { if (active) setResult({ accountId, stories: data }) })
      .catch(failure => { if (active) setResult({ accountId, error: authError(failure) }) })
    return () => { active = false }
  }, [loading, accountId])
  if (loading || !accountId || result?.accountId !== accountId) return null
  if (!result.error && !result.stories?.length) return null
  return <section aria-labelledby="my-drafts-heading" className="mt-8 rounded-3xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-slate-900">
    <h2 id="my-drafts-heading" className="text-xl font-bold text-slate-900 dark:text-slate-100">Your drafts</h2>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Only you can see these draft chapters. Open the editor to keep writing or publish when ready.</p>
    {result.error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{result.error}</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{result.stories?.map(story => <Link key={story.id} to={`/stories/${encodeURIComponent(story.id)}/edit`} className="rounded-2xl border border-blue-200 bg-white p-4 hover:border-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800">
      <span className="block break-words font-semibold">{story.title}</span>
      <span className="mt-2 block text-sm text-slate-500 dark:text-slate-300">{story.draftChapterCount} {story.draftChapterCount === 1 ? 'draft chapter' : 'draft chapters'} · {story.publishedChapterCount} published</span>
      <span className="mt-3 block text-sm font-semibold text-blue-700 dark:text-blue-300">Continue editing →</span>
    </Link>)}</div>
  </section>
}
export default MyDraftStories
