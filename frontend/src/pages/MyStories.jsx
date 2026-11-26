import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/auth.js'
import { api, authError } from '../lib/api.js'
import StoryRating from '../components/StoryRating.jsx'

const MyStories = () => {
  const { user, loading } = useAuth()
  const accountId = user?._id
  const canUpload = ['writer', 'admin'].includes(user?.role)
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (loading || !accountId) return undefined
    let active = true
    api.get('/stories/mine').then(({ data }) => { if (active) setResult({ accountId, stories: data }) })
      .catch(failure => { if (active) setResult({ accountId, error: authError(failure) }) })
    return () => { active = false }
  }, [loading, accountId, attempt])
  if (!loading && !user) return <Navigate to="/login" state={{ returnTo: '/my-stories' }} replace />
  const current = result?.accountId === accountId ? result : null
  return <main className="mx-auto w-full max-w-6xl pb-24 pt-10">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold">My stories</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Your published stories and private drafts.</p></div>
      {canUpload && <Link to="/stories/new" className="rounded-full bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800">Start a story</Link>}
    </div>
    {(loading || !current) && <p role="status" className="mt-8">Loading your stories…</p>}
    {current?.error && <div role="alert" className="mt-8"><p>{current.error}</p><button type="button" onClick={() => { setResult(null); setAttempt(value => value + 1) }} className="mt-3 text-blue-700 underline dark:text-blue-300">Try again</button></div>}
    {current?.stories?.length === 0 && <div className="mt-8 rounded-3xl border border-blue-100 bg-white p-8 dark:border-slate-700 dark:bg-slate-900">
      <p>You haven’t written any stories yet.</p>
      {canUpload ? <Link to="/stories/new" className="mt-3 inline-block font-semibold text-blue-700 underline dark:text-blue-300">Start your first story</Link> : <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Ask an admin for the writer role to start sharing your stories.</p>}
    </div>}
    <div className="mt-8 grid gap-5 md:grid-cols-2">{current?.stories?.map(story => <article key={story.id} className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {story.coverImage && <img src={story.coverImage} alt={story.coverAlt} className="h-56 w-full object-cover" />}
      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="break-words text-xl font-bold">{story.title}<span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">by {user?.username}</span></h2><StoryRating value={story.contentRating} /></div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{story.publishedChapterCount} published · {story.draftChapterCount} draft {story.draftChapterCount === 1 ? 'chapter' : 'chapters'}</p>
        <div className="mt-5 flex flex-wrap gap-5 text-sm font-semibold text-blue-700 dark:text-blue-300">
          <Link to={`/stories/${encodeURIComponent(story.id)}/edit`} className="hover:underline">Edit story</Link>
          {story.publishedChapterCount > 0 && <Link to={`/stories/${encodeURIComponent(story.id)}`} className="hover:underline">Read story</Link>}
        </div>
      </div>
    </article>)}</div>
  </main>
}
export default MyStories
