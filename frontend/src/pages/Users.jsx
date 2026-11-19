import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { FiUser, FiX } from 'react-icons/fi'
import { useAuth } from '../context/auth.js'
import { api, authError } from '../lib/api.js'

const UserDetails = ({ id, onClose }) => {
  const dialog = useRef(null)
  const [details, setDetails] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    let active = true
    api.get(`/user/admin/users/${id}`).then(({ data }) => { if (active) setDetails(data) }).catch(failure => { if (active) setError(authError(failure)) })
    return () => { active = false; element.close(); document.body.style.overflow = overflow; previous?.focus() }
  }, [id])
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="user-details-title" className="user-details-dialog m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-3xl border border-blue-100 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-8">
    <div className="flex items-center justify-between gap-4"><h2 id="user-details-title" className="text-2xl font-bold">{details?.user.username || 'User details'}</h2><button autoFocus type="button" onClick={onClose} aria-label="Close user details" className="rounded-full p-3 hover:bg-blue-50 dark:hover:bg-slate-800"><FiX /></button></div>
    {error && <p role="alert" className="mt-5 text-red-700 dark:text-red-300">{error}</p>}
    {!details && !error && <p role="status" className="mt-5">Loading user details…</p>}
    {details && <>
      <p className="mt-3 break-all text-slate-600 dark:text-slate-300">{details.user.email}</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Role: {details.user.role} · Joined {new Date(details.user.createdAt).toLocaleDateString()}</p>
      <h3 className="mt-8 text-lg font-bold">Profile picture history</h3>
      {details.photoHistory.length ? <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">{details.photoHistory.map(photo => <figure key={photo.id} className="rounded-2xl border border-blue-100 bg-blue-50 p-3 dark:border-slate-700 dark:bg-slate-800"><img src={photo.url} alt={`${details.user.username} profile history`} className="aspect-square w-full rounded-xl object-cover" /><figcaption className="mt-2 text-xs text-slate-600 dark:text-slate-300">{photo.current ? 'Current picture' : 'Replaced / archived'}{photo.uploadedAt && <span className="mt-1 block">{new Date(photo.uploadedAt).toLocaleString()}</span>}</figcaption></figure>)}</div> : <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No profile pictures recorded.</p>}
      <h3 className="mt-8 text-lg font-bold">Story participation</h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Reading history is not tracked. These are chapters where this user has commented or replied. Counts include moderated comments.</p>
      {!details.participation.length && <p className="mt-4 text-sm">No story participation recorded.</p>}
      <div className="mt-4 space-y-3">{details.participation.map(story => <div key={story.id} className="rounded-xl bg-blue-50 p-4 dark:bg-slate-800"><p className="font-semibold">{story.deleted ? <>{story.title} · Deleted story</> : <Link to={`/stories/${story.id}`} onClick={onClose} className="text-blue-700 hover:underline dark:text-blue-300">{story.title}</Link>}</p><p className="mt-2 text-sm">{story.commentCount} comments / replies</p><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{story.chapters.map(chapter => `Chapter ${chapter.number}: ${chapter.title}`).join(' · ')}</p></div>)}</div>
      <h3 className="mt-8 text-lg font-bold">Stories uploaded</h3>
      <ul className="mt-3 space-y-2 text-sm">{details.authoredStories.map(story => <li key={story.id}>{story.deleted ? `${story.title} · Deleted story` : <Link to={`/stories/${story.id}`} onClick={onClose} className="text-blue-700 hover:underline dark:text-blue-300">{story.title}</Link>}</li>)}</ul>
      {!details.authoredStories.length && <p className="mt-3 text-sm">No stories uploaded.</p>}
    </>}
  </dialog>
}

const Users = () => {
  const { user, loading } = useAuth()
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  useEffect(() => {
    if (loading || user?.role !== 'admin') return undefined
    let active = true
    api.get(`/user/admin/users?page=${page}`).then(({ data }) => { if (active) { setResult(data); setError('') } }).catch(failure => { if (active) setError(authError(failure)) })
    return () => { active = false }
  }, [page, user?._id, user?.role, loading])
  if (loading) return <main className="py-16" role="status">Checking your account…</main>
  if (!user) return <Navigate to="/login" state={{ returnTo: '/admin/users' }} replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  const ready = result?.page === page
  return <main className="mx-auto max-w-6xl py-10">
    <p className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Administration</p><h1 className="mt-2 text-3xl font-bold">Users</h1>
    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{result ? `${result.total} registered users. ` : ''}Select a user to view their profile history and story participation.</p>
    {error && <p role="alert" className="mt-5 text-red-700 dark:text-red-300">{error}</p>}
    {!ready && !error && <p role="status" className="mt-5">Loading users…</p>}
    {ready && <><div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{result.users.map(person => <button key={person._id} type="button" onClick={() => setSelected(person._id)} className="flex min-w-0 flex-col items-center rounded-3xl border border-blue-100 bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900">
      {person.profilePic ? <img src={person.profilePic} alt="" className="h-24 w-24 rounded-full object-cover" /> : <span className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-4xl text-blue-700 dark:bg-blue-950 dark:text-blue-300"><FiUser aria-hidden="true" /></span>}
      <span className="mt-4 w-full truncate font-bold">{person.username}</span><span className="mt-2 w-full break-all text-sm text-slate-500 dark:text-slate-400">{person.email}</span>
    </button>)}</div>{!result.users.length && <p className="mt-7">No users found.</p>}</>}
    <div className="mt-7 flex items-center justify-between gap-3"><button disabled={page === 1} onClick={() => setPage(current => current - 1)} className="rounded-full border border-blue-200 px-5 py-2 text-sm disabled:opacity-40 dark:border-slate-700">Previous</button><p className="text-sm">Page {page}{result ? ` of ${result.pages}` : ''}</p><button disabled={!ready || page >= result.pages} onClick={() => setPage(current => current + 1)} className="rounded-full border border-blue-200 px-5 py-2 text-sm disabled:opacity-40 dark:border-slate-700">Next</button></div>
    {selected && <UserDetails key={selected} id={selected} onClose={() => setSelected(null)} />}
  </main>
}
export default Users
