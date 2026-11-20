import { useEffect, useId, useRef, useState } from 'react'
import { FiX } from 'react-icons/fi'
import { api, authError } from '../lib/api.js'

const InviteReaders = ({ story, onClose }) => {
  const dialog = useRef(null)
  const pending = useRef(false)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [sending, setSending] = useState(null)
  const [sent, setSent] = useState({})
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const id = useId()
  const search = query.trim().replace(/^@/, '')
  const validSearch = /^[a-zA-Z0-9]{2,20}$/.test(search)
  const current = result?.query === search ? result : null
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    element.showModal(); document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => {
    if (!validSearch) return undefined
    let active = true
    const timer = setTimeout(() => {
      api.get(`/stories/${encodeURIComponent(story.id)}/invitees`, { params: { q: search } })
        .then(({ data }) => { if (active) setResult({ query: search, users: data.users }) })
        .catch(failure => { if (active) setResult({ query: search, users: [], error: authError(failure) }) })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [story.id, search, validSearch])
  const invite = async username => {
    if (pending.current || sent[username]) return
    pending.current = true; setSending(username); setStatus(''); setError('')
    try {
      const { data } = await api.post(`/stories/${encodeURIComponent(story.id)}/invitations`, { username })
      setSent(current => ({ ...current, [username]: true }))
      setStatus(data.alreadySent ? `${data.username} already has a pending invitation.` : `Invitation sent to ${data.username}.`)
    } catch (failure) { setError(authError(failure)) }
    finally { pending.current = false; setSending(null) }
  }
  return <dialog ref={dialog} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target !== event.currentTarget) return; const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose() }}
    className="m-auto max-h-[85dvh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-blue-100 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-black/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
    <div className="flex items-center justify-between gap-3"><h2 id={`${id}-title`} className="text-xl font-bold">Invite readers</h2><button type="button" onClick={onClose} aria-label="Close invitations" className="rounded-full p-2 hover:bg-blue-50 dark:hover:bg-slate-800"><FiX /></button></div>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Invite someone to read <strong>{story.title}</strong>. They’ll receive a notification linking to your story.</p>
    <label htmlFor={`${id}-username`} className="mt-5 block text-sm font-semibold">Search by username</label>
    <input autoFocus id={`${id}-username`} value={query} onChange={event => setQuery(event.target.value)} maxLength={21} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Type a username…" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800" />
    {!validSearch && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Enter at least two letters or numbers to find a reader.</p>}
    {validSearch && !current && <p role="status" className="mt-4 text-sm">Searching readers…</p>}
    {current?.error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{current.error}</p>}
    {current && !current.error && !current.users.length && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No matching readers are accepting invitations for this story.</p>}
    <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">{current?.users.map(reader => <li key={reader.id} className="flex items-center gap-3 rounded-xl bg-blue-50 p-3 dark:bg-slate-800">
      {reader.profilePic ? <img src={reader.profilePic} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">{reader.username.charAt(0).toUpperCase()}</span>}
      <span className="min-w-0 flex-1 break-words text-sm font-semibold">{reader.username}</span>
      <button type="button" disabled={!!sending || sent[reader.username]} onClick={() => invite(reader.username)} className="shrink-0 rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{sending === reader.username ? 'Sending…' : sent[reader.username] ? 'Invited' : 'Invite'}</button>
    </li>)}</ul>
    {status && <p role="status" className="mt-4 text-sm text-green-700 dark:text-green-300">{status}</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p>}
    <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Up to 20 invitations per 24 hours. Readers can turn invitations off in their profile.</p>
    {story.contentRating === 'mature' && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">This invitation will be labeled Mature. Readers can receive it even if Mature stories are hidden from their feed.</p>}
  </dialog>
}
export default InviteReaders
