import { useViewportPanel } from '../lib/useViewportPanel.js'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth.js'
import { authError } from '../lib/api.js'
import { useEffect, useRef, useState } from 'react'
import { FiCamera, FiImage, FiUser, FiX, FiEdit2 } from 'react-icons/fi'

const ProfileMenu = () => {
  const { user, loading, logout, requireAccount, uploadProfilePic, updateUsername } = useAuth()
  const [editingUsername, setEditingUsername] = useState(false)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const usernameSaveRef = useRef(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [open, setOpen] = useState(false)
  const photoUrl = user?.profilePic
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const menuRef = useRef(null)
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  useViewportPanel(open, menuRef, panelRef)

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
      return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const choosePhoto = async (event) => {
    if (!requireAccount('Sign up to choose a profile picture.')) return
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Choose a PNG, JPEG, WebP, or GIF image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Choose an image smaller than 5 MB.')
      return
    }
    setError('')
    setSuccess('')
    setUploading(true)
    try {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Unable to read image.'))
        reader.readAsDataURL(file)
      })
      await uploadProfilePic(image)
      setSuccess('Profile picture saved.')
    } catch (failure) {
      setError(authError(failure))
    } finally {
      setUploading(false)
    }
  }

  const saveUsername = async event => {
    event.preventDefault()
    if (usernameSaveRef.current) return
    usernameSaveRef.current = true
    setSavingUsername(true)
    setError('')
    setSuccess('')
    try {
      await updateUsername(usernameDraft)
      setEditingUsername(false)
      setSuccess('Username updated.')
    } catch (failure) { setError(authError(failure)) }
    finally { usernameSaveRef.current = false; setSavingUsername(false) }
  }

  return (
    <div ref={menuRef} className="relative order-2 lg:order-3">
      <button type="button" onClick={() => { setOpen(current => !current); setEditingUsername(false); setError(''); setSuccess('') }} aria-label="Profile picture" aria-expanded={open} aria-controls="profile-picture-menu"
        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white dark:border-slate-700 bg-blue-100 dark:bg-blue-950 text-xl text-blue-700 dark:text-blue-300 shadow-md shadow-blue-900/10 transition hover:ring-2 hover:ring-blue-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
        {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : <FiUser aria-hidden="true" />}
      </button>

      {open && <div ref={panelRef} id="profile-picture-menu" className="absolute right-0 top-full z-40 mt-3 w-[min(20rem,calc(100vw_-_2rem))] overflow-y-auto overscroll-contain rounded-3xl border border-blue-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-slate-900 dark:text-slate-100 shadow-2xl shadow-blue-950/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Your space</p>
            <h2 className="mt-1 text-lg font-bold">Profile picture</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close profile menu" className="rounded-full p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-700"><FiX aria-hidden="true" /></button>
        </div>

        <div className="mt-5 flex items-center gap-4 rounded-2xl bg-blue-50 dark:bg-slate-800 p-4">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white dark:border-slate-700 bg-blue-200 dark:bg-blue-900 text-3xl text-blue-700 dark:text-blue-300 shadow-sm">
            {photoUrl ? <img src={photoUrl} alt="Your profile picture" className="h-full w-full object-cover" /> : <FiCamera aria-hidden="true" />}
          </span>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{photoUrl ? 'Your saved profile picture.' : 'Choose a photo for your profile.'}</p>
        </div>

        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={choosePhoto} className="sr-only" aria-label="Choose a profile picture" />
        <button type="button" disabled={loading || uploading || savingUsername} onClick={() => { if (requireAccount('Sign up to choose a profile picture.')) inputRef.current?.click(); else setOpen(false) }} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
          <FiImage aria-hidden="true" /> {uploading ? 'Saving...' : photoUrl ? 'Change picture' : 'Choose picture'}
        </button>
        {success && <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-300">{success}</p>}
        {error && <p role="alert" className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">{error}</p>}
        <div className="mt-4 border-t border-blue-100 dark:border-slate-700 pt-4">
          {user ? <>{editingUsername ? <form onSubmit={saveUsername} className="mb-4">
            <label htmlFor="profile-username" className="text-sm font-semibold">Username</label>
            <input id="profile-username" autoFocus value={usernameDraft} onChange={event => setUsernameDraft(event.target.value)} required minLength={3} maxLength={20} pattern="[a-zA-Z0-9]+" autoComplete="username" disabled={savingUsername} aria-describedby="username-rules" className="mt-2 w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            <p id="username-rules" className="mt-2 text-xs text-slate-500 dark:text-slate-400">3–20 letters and numbers.</p>
            <div className="mt-3 flex gap-3"><button type="submit" disabled={savingUsername} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{savingUsername ? 'Saving…' : 'Save'}</button><button type="button" disabled={savingUsername} onClick={() => { setEditingUsername(false); setError('') }} className="px-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Cancel</button></div>
          </form> : <div className="mb-3 flex items-center gap-2"><p className="min-w-0 truncate text-sm font-semibold">{user.username}</p><button type="button" disabled={uploading || loggingOut} aria-label="Edit username" onClick={() => { setUsernameDraft(user.username); setEditingUsername(true); setError(''); setSuccess('') }} className="rounded-full p-2 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-700"><FiEdit2 aria-hidden="true" /></button></div>}<button type="button" disabled={loggingOut || uploading || savingUsername} onClick={async () => { setLoggingOut(true); setError(''); try { await logout(); setOpen(false) } catch (failure) { setError(authError(failure)) } finally { setLoggingOut(false) } }} className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline">{loggingOut ? 'Logging out...' : 'Log out'}</button></> : <div className="flex gap-4"><Link to="/signup" onClick={() => setOpen(false)} className="font-semibold text-blue-700 dark:text-blue-300">Sign up</Link><Link to="/login" onClick={() => setOpen(false)} className="font-semibold text-blue-700 dark:text-blue-300">Log in</Link></div>}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">PNG, JPEG, WebP, or GIF. Maximum 5 MB.</p>
      </div>}
    </div>
  )
}

export default ProfileMenu
