import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { FiX } from 'react-icons/fi'
import { useAuth } from '../context/auth.js'
import { api, authError } from '../lib/api.js'
const FeedbackDetail = ({ id, onClose, onRead }) => {
  const dialog = useRef(null)
  const [item, setItem] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    element.showModal(); document.body.style.overflow = 'hidden'
    let active = true
    api.get(`/feedback/${id}`).then(({ data }) => { if (active) { setItem(data); onRead(id); window.dispatchEvent(new Event('feedback-updated')) } }).catch(failure => { if (active) setError(authError(failure)) })
    return () => { active = false; element.close(); document.body.style.overflow = overflow; previous?.focus() }
  }, [id, onRead])
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="feedback-subject" className="feedback-detail-dialog m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-3xl bg-white p-8 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-slate-100">
    <div className="flex items-start justify-between gap-4"><h2 id="feedback-subject" className="break-words text-2xl font-bold">{item?.subject || 'Feedback'}</h2><button autoFocus type="button" onClick={onClose} aria-label="Close feedback" className="shrink-0 rounded-full p-2 hover:bg-blue-50 dark:hover:bg-slate-800"><FiX /></button></div>
    {!item && !error && <p role="status" className="mt-5">Loading feedback…</p>}{error && <p role="alert" className="mt-5 text-red-700 dark:text-red-300">{error}</p>}
    {item && <><p className="mt-5 break-words font-semibold">{item.username}</p><p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">{item.email}</p><time className="mt-2 block text-xs text-slate-500 dark:text-slate-400" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time><p className="mt-7 whitespace-pre-wrap break-words leading-relaxed">{item.message}</p></>}
  </dialog>
}
const AdminFeedback = () => {
  const { user, loading } = useAuth()
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const markRead = useCallback(id => { setResult(current => current ? { ...current, items: current.items.map(item => item.id === id ? { ...item, unread: false } : item) } : current) }, [])
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  useEffect(() => {
    if (loading || user?.role !== 'admin') return undefined
    let active = true
    api.get(`/feedback?page=${page}`).then(({ data }) => { if (active) { setResult(data); setError('') } }).catch(failure => { if (active) setError(authError(failure)) })
    return () => { active = false }
  }, [page, user?._id, user?.role, loading])
  if (loading) return <main className="py-16" role="status">Checking your account…</main>
  if (!user) return <Navigate to="/login" state={{ returnTo: '/admin/feedback' }} replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  const ready = result?.page === page
  return <main className="mx-auto max-w-6xl py-10"><p className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Administration</p><h1 className="mt-2 text-3xl font-bold">Feedback</h1><p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Select a message to read it. Unread status is tracked separately for each admin.</p>
    {error && <p role="alert" className="mt-5 text-red-700 dark:text-red-300">{error}</p>}{!ready && !error && <p role="status" className="mt-5">Loading feedback…</p>}
    {ready && <><div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{result.items.map(item => <button key={item.id} type="button" onClick={() => setSelected(item.id)} className={`min-w-0 rounded-2xl border bg-white p-5 text-left shadow-sm hover:border-blue-400 dark:bg-slate-900 ${item.unread ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'}`}><span className="flex items-center justify-between gap-3"><span className="truncate font-bold">{item.subject}</span>{item.unread && <span className="shrink-0 rounded-full bg-red-600 px-2 py-1 text-xs text-white">New</span>}</span><span className="mt-3 block truncate text-sm font-semibold">{item.username}</span><span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{item.email}</span><span className="mt-4 line-clamp-3 block break-words text-sm text-slate-600 dark:text-slate-300">{item.preview}</span><time dateTime={item.createdAt} className="mt-4 block text-xs text-slate-500 dark:text-slate-400">{new Date(item.createdAt).toLocaleString()}</time></button>)}</div>{!result.items.length && <p className="mt-7">No feedback yet.</p>}</>}
    <div className="mt-7 flex items-center justify-between"><button disabled={page === 1} onClick={() => setPage(current => current - 1)} className="rounded-full border border-blue-200 px-5 py-2 disabled:opacity-40 dark:border-slate-700">Previous</button><p className="text-sm">Page {page}{result ? ` of ${result.pages}` : ''}</p><button disabled={!ready || page >= result.pages} onClick={() => setPage(current => current + 1)} className="rounded-full border border-blue-200 px-5 py-2 disabled:opacity-40 dark:border-slate-700">Next</button></div>
    {selected && <FeedbackDetail key={selected} id={selected} onClose={() => setSelected(null)} onRead={markRead} />}
  </main>
}
export default AdminFeedback
