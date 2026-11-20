import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../context/auth.js'
import { FiArrowRight, FiBookOpen, FiPlusCircle } from 'react-icons/fi'
import { Link } from 'react-router-dom'

const Home = () => {
  const { user, loading } = useAuth()
  const [savedStories, setSavedStories] = useState([])
  const [libraryError, setLibraryError] = useState('')
  useEffect(() => {
    let active = true
    api.get('/stories').then(({ data }) => { if (active) setSavedStories(data) })
      .catch(() => { if (active) setLibraryError('Stories could not be loaded. Please refresh to try again.') })
    return () => { active = false }
  }, [])
  return (
  <main className="mx-auto w-full max-w-6xl pb-32 pt-10">
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-800 via-blue-700 to-sky-600 px-7 py-12 text-white shadow-xl shadow-blue-900/15 sm:px-12 sm:py-16">
      <div aria-hidden="true" className="absolute -right-16 -top-20 h-72 w-72 rounded-full border-[44px] border-white/10" />
      <div className="relative max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"><FiBookOpen aria-hidden="true" /> Welcome to Storytelling</span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">A place to read and talk about stories.</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-blue-100">Pick a story, settle in, and join the conversation when you finish.</p>
        <Link to={savedStories.length ? `/stories/${savedStories[0].id}` : "/#stories"} className="mt-7 inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-900 px-5 py-3 text-sm font-bold text-blue-800 dark:text-blue-200 shadow-lg transition hover:bg-blue-50 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          {savedStories.length ? 'Read the featured story' : 'Explore the library'} <FiArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>

    <section id="stories" className="scroll-mt-32 pt-10">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">The library</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Stories</h2>
      </div>
      {libraryError && <p role="status" className="mb-4 text-sm text-slate-600 dark:text-slate-300">{libraryError}</p>}
      {!savedStories.length && !libraryError && <p className="mb-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 p-6 text-slate-600 dark:text-slate-300">No stories yet. New stories will appear here when they’re uploaded.</p>}
      <div className="grid gap-5 md:grid-cols-2">
        {savedStories.map((story) => (
          <Link key={story.id} to={`/stories/${story.id}`} className="group overflow-hidden rounded-3xl border border-white dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg shadow-blue-900/5 transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
            {story.coverImage ? <img src={story.coverImage} alt={story.coverAlt} className="h-56 w-full object-cover" /> : (
              <div aria-hidden="true" className="relative flex h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-900 via-blue-800 to-sky-600 text-white">
                <span className="absolute -right-12 -top-16 h-52 w-52 rounded-full border-[30px] border-white/10" />
                <span className="text-7xl font-light">✦</span>
              </div>
            )}
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{story.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{story.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-300 group-hover:underline">Read story <FiArrowRight aria-hidden="true" /></span>
            </div>
          </Link>
        ))}
      </div>
    </section>
    {!loading && ['writer', 'admin'].includes(user?.role) && <>
      <Link to="/admin/story-upload" className="fixed bottom-6 right-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/30 bg-blue-700 px-6 py-4 text-sm font-bold text-white shadow-xl shadow-blue-950/25 transition hover:-translate-y-1 hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 sm:bottom-8 sm:right-8">
        <FiPlusCircle aria-hidden="true" className="text-lg" /> Upload stories
      </Link>
    </>}
  </main>
  )
}

export default Home
