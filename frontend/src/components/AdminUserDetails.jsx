import { useAuth } from '../context/auth.js'
import UserRoleForm from './UserRoleForm.jsx'
import CommentRestrictionForm from './CommentRestrictionForm.jsx'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiX } from 'react-icons/fi'
import { api, authError } from '../lib/api.js'

const UserDetails = ({ id, onClose, onRoleSaved }) => {
  const { user } = useAuth()
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
  return <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target !== event.currentTarget) return; const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose() }} aria-labelledby="user-details-title" className="user-details-dialog m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-3xl border border-blue-100 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-8">
    <div className="flex items-center justify-between gap-4"><h2 id="user-details-title" className="text-2xl font-bold">{details?.user.username || 'User details'}</h2><button autoFocus type="button" onClick={onClose} aria-label="Close user details" className="rounded-full p-3 hover:bg-blue-50 dark:hover:bg-slate-800"><FiX /></button></div>
    {error && <p role="alert" className="mt-5 text-red-700 dark:text-red-300">{error}</p>}
    {!details && !error && <p role="status" className="mt-5">Loading user details…</p>}
    {details && <>
      <p className="mt-3 break-all text-slate-600 dark:text-slate-300">{details.user.email}</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Role: {details.user.role} · Joined {new Date(details.user.createdAt).toLocaleDateString()}</p>
      <UserRoleForm key={id} userId={id} currentRole={details.user.role} onSaved={updated => { setDetails(current => ({ ...current, user: { ...current.user, role: updated.role } })); onRoleSaved?.(updated) }} />
      <CommentRestrictionForm userId={id} restriction={details.user.commentRestriction} onSaved={restriction => setDetails(current => ({ ...current, user: { ...current.user, commentRestriction: restriction } }))} />
      <h3 className="mt-8 text-lg font-bold">Profile picture history</h3>
      {details.photoHistory.length ? <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">{details.photoHistory.map(photo => <figure key={photo.id} className="rounded-2xl border border-blue-100 bg-blue-50 p-3 dark:border-slate-700 dark:bg-slate-800"><img src={photo.url} alt={`${details.user.username} profile history`} className="aspect-square w-full rounded-xl object-cover" /><figcaption className="mt-2 text-xs text-slate-600 dark:text-slate-300">{photo.current ? 'Current picture' : 'Replaced / archived'}{photo.uploadedAt && <span className="mt-1 block">{new Date(photo.uploadedAt).toLocaleString()}</span>}</figcaption></figure>)}</div> : <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No profile pictures recorded.</p>}
      <h3 className="mt-8 text-lg font-bold">Story participation</h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Reading history is not tracked. These are chapters where this user has commented or replied. Counts include moderated comments.</p>
      {!details.participation.length && <p className="mt-4 text-sm">No story participation recorded.</p>}
      <div className="mt-4 space-y-3">{details.participation.map(story => <div key={story.id} className="rounded-xl bg-blue-50 p-4 dark:bg-slate-800"><p className="font-semibold">{story.deleted ? <>{story.title} · Deleted story</> : <Link to={`/stories/${story.id}`} onClick={onClose} className="text-blue-700 hover:underline dark:text-blue-300">{story.title}</Link>}</p><p className="mt-2 text-sm">{story.commentCount} comments / replies</p><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{story.chapters.map(chapter => `Chapter ${chapter.number}: ${chapter.title}`).join(' · ')}</p></div>)}</div>
      <h3 className="mt-8 text-lg font-bold">Stories uploaded</h3>
      {String(user?._id) === String(details.user._id) && <Link to="/my-stories" onClick={onClose} className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">My stories →</Link>}
      <ul className="mt-3 space-y-2 text-sm">{details.authoredStories.map(story => <li key={story.id}>{story.deleted ? `${story.title} · Deleted story` : <Link to={`/stories/${story.id}`} onClick={onClose} className="text-blue-700 hover:underline dark:text-blue-300">{story.title}</Link>}</li>)}</ul>
      {!details.authoredStories.length && <p className="mt-3 text-sm">No stories uploaded.</p>}
    </>}
  </dialog>
}


export default UserDetails
