import { notificationLink } from '../lib/notificationLinks.js'
import { useViewportPanel } from '../lib/useViewportPanel.js'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiBell, FiX } from 'react-icons/fi'
import { api, authError } from '../lib/api.js'

const NotificationMenu = () => {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  const panelRef = useRef(null)
  useViewportPanel(open, root, panelRef)
  const navigate = useNavigate()
  useEffect(() => {
    let active = true
    let pending = false
    const refresh = async () => {
      if (pending || document.hidden) return
      pending = true
      try {
        const { data: fresh } = await api.get('/notifications')
        if (active) { setData(fresh); setError('') }
      } catch (failure) { if (active) setError(authError(failure)) }
      finally { pending = false }
    }
    refresh()
    const interval = setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [open])
  useEffect(() => {
    if (!open) return undefined
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false) }
    const escape = event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  const openNotification = async item => {
    if (busy) return
    setBusy(true)
    try {
      if (!item.readAt) {
        const { data: read } = await api.patch(`/notifications/${item.id}/read`)
        setData(current => ({ ...current, unreadCount: Math.max(0, current.unreadCount - 1), items: current.items.map(row => row.id === item.id ? { ...row, readAt: read.readAt } : row) }))
      }
      setOpen(false)
      navigate(notificationLink(item))
    } catch (failure) { setError(authError(failure)) }
    finally { setBusy(false) }
  }
  const markAll = async () => {
    setBusy(true)
    try {
      await api.patch('/notifications/read-all')
      setData(current => ({ ...current, unreadCount: 0, items: current.items.map(item => ({ ...item, readAt: new Date().toISOString() })) }))
    } catch (failure) { setError(authError(failure)) }
    finally { setBusy(false) }
  }
  const count = data?.unreadCount || 0
  return <div ref={root} className="relative">
    <button ref={trigger} type="button" onClick={() => setOpen(current => !current)} aria-label={`Notifications${count ? `, ${count} unread` : ''}`} aria-expanded={open} aria-controls="notifications-panel" className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-xl text-blue-700 dark:text-blue-300 shadow-sm hover:bg-blue-50 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-700">
      <FiBell aria-hidden="true" />
      {count > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white dark:border-slate-700 bg-red-600 px-1 text-[10px] font-bold text-white">{count > 99 ? '99+' : count}</span>}
    </button>
    {open && <section ref={panelRef} id="notifications-panel" aria-label="Notifications" className="absolute right-0 top-full z-40 mt-3 w-[min(23rem,calc(100vw_-_2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-blue-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
      <div className="flex items-center justify-between p-4"><h2 className="font-bold text-slate-900 dark:text-slate-100">Notifications</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close notifications" className="rounded-full p-2 text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800"><FiX /></button></div>
      {count > 0 && <button type="button" disabled={busy} onClick={markAll} className="mx-4 mb-3 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline disabled:opacity-50">Mark all as read</button>}
      {error && <p role="alert" className="px-4 pb-4 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {!data && !error && <p role="status" className="p-4 text-sm text-slate-500 dark:text-slate-400">Loading notifications…</p>}
      {data?.items.length === 0 && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">No notifications yet. Story invitations, replies, and new chapters will appear here.</p>}
      <ul className="max-h-96 overflow-y-auto">{data?.items.map(item => <li key={item.id}><button type="button" disabled={busy} onClick={() => openNotification(item)} className={`w-full border-t border-blue-100 dark:border-slate-700 p-4 text-left text-sm hover:bg-blue-100 dark:hover:bg-blue-950 disabled:opacity-60 ${item.readAt ? 'bg-white dark:bg-slate-900' : 'bg-blue-50 dark:bg-slate-800'}`}>
        <span className="block text-slate-800 dark:text-slate-200">{item.type === 'story_invite' ? <><strong>{item.actorName}</strong> invited you to read <strong>{item.storyTitle}</strong>.</> : item.type === 'new_chapter' ? <>Chapter {item.chapterNumber} of <strong>{item.storyTitle}</strong> has been added. Give it a read!</> : <><strong>{item.actorName}</strong> replied to your comment</>}{!item.readAt && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-600" aria-label="Unread" />}</span>
        <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{item.storyTitle}{item.type === 'story_invite' && item.contentRating === 'mature' ? ' · Mature' : ''}</span>
        <time dateTime={item.createdAt} className="mt-1 block text-xs text-slate-400 dark:text-slate-400">{new Date(item.createdAt).toLocaleString()}</time>
      </button></li>)}</ul>
    </section>}
  </div>
}
export default NotificationMenu
