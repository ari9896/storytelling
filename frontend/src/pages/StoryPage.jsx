import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../context/auth.js'
import { Link, useParams, useLocation } from 'react-router-dom'
import StorytellingSandbox from './StorytellingSandbox.jsx'

const StoryPage = () => {
  const { storyId } = useParams()
  const location = useLocation()
  const { user, loading } = useAuth()
  const accountId = user?._id || 'guest'
  const [result, setResult] = useState(null)
  const refreshStory = useCallback(async () => {
    const { data } = await api.get(`/stories/${encodeURIComponent(storyId)}`)
    setResult({ id: storyId, accountId, story: data })
  }, [storyId, accountId])
  useEffect(() => {
    if (loading) return undefined
    let active = true
    api.get(`/stories/${encodeURIComponent(storyId)}`).then(({ data }) => {
      if (active) setResult({ id: storyId, accountId, story: data })
    }).catch(error => {
      if (active) setResult({ id: storyId, accountId, error: error.response?.status === 404 ? 'Story not found' : 'Unable to load story. Please refresh to try again.' })
    })
    return () => { active = false }
  }, [storyId, accountId, loading])
  if (loading || result?.id !== storyId || result.accountId !== accountId) return <main className="mx-auto max-w-5xl py-16" role="status">Loading story…</main>
  if (!result.story) return <main className="mx-auto max-w-5xl py-16"><h1 className="text-3xl font-bold">{result.error}</h1><Link to="/#stories" className="mt-5 inline-block text-blue-700 dark:text-blue-300 underline">Browse stories</Link></main>
  return <StorytellingSandbox key={`${storyId}-${accountId}-${location.search}-${location.hash}`} story={result.story} onProgressSaved={refreshStory} />
}
export default StoryPage
