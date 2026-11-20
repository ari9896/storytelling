import { useEffect, useRef, useState } from 'react'
import { FiUser, FiX } from 'react-icons/fi'
import { api, authError } from '../lib/api.js'
import { useAuth } from '../context/auth.js'
import AdminUserDetails from './AdminUserDetails.jsx'

const PublicUserCard = ({ id, onClose }) => {
  const dialog = useRef(null)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    element.showModal(); document.body.style.overflow = 'hidden'
    let active = true
    api.get(`/user/public/${encodeURIComponent(id)}`).then(({ data }) => { if (active) setProfile(data) }).catch(failure => { if (active) setError(authError(failure)) })
    return () => { active = false; element.close(); document.body.style.overflow = overflow; previous?.focus() }
  }, [id])
  return <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target !== event.currentTarget) return; const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose() }} aria-labelledby="comment-profile-heading" className="user-details-dialog m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-3xl border border-blue-100 bg-white p-8 text-center text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
    <button autoFocus type="button" onClick={onClose} aria-label="Close user profile" className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-blue-50 dark:text-slate-400 dark:hover:bg-slate-800"><FiX /></button>
    <h2 id="comment-profile-heading" className="mb-6 text-sm font-semibold text-slate-500 dark:text-slate-400">Reader profile</h2>
    {!profile && !error && <p role="status">Loading profile…</p>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    {profile && <>{profile.profilePic ? <img src={profile.profilePic} alt={`${profile.username} profile picture`} className="mx-auto h-28 w-28 rounded-full object-cover" /> : <span className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-blue-100 text-4xl text-blue-700 dark:bg-blue-950 dark:text-blue-300"><FiUser aria-hidden="true" /></span>}<p className="mt-5 break-words text-2xl font-bold">{profile.username}</p>{profile.createdAt && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>}</>}
  </dialog>
}
const UserCard = props => {
  const { user } = useAuth()
  return user?.role === 'admin' ? <AdminUserDetails {...props} /> : <PublicUserCard {...props} />
}
export default UserCard
