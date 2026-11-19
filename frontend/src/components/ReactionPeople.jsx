import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'
import { api, authError } from '../lib/api.js'

const peoplePath = (storyId, chapterId, commentId, emoji, page = 1, limit = 10) =>
  `/stories/${encodeURIComponent(storyId)}/chapters/${chapterId}/comments/${commentId}/reactions/users?${new URLSearchParams({ emoji, page, limit })}`

const People = ({ users, onProfile }) => <ul className="space-y-1">{users.map(user => <li key={user.id}>
  <button type="button" onClick={() => onProfile(user.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800">
    {user.profilePic ? <img src={user.profilePic} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" /> : <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">{user.username.charAt(0).toUpperCase()}</span>}
    <span className="min-w-0 break-words font-semibold">{user.username}</span>
  </button>
</li>)}</ul>

export const ReactionChip = ({ emoji, count, selected, disabled, onReact, onProfile, onViewMore, storyId, chapterId, commentId }) => {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState(null)
  const [retry, setRetry] = useState(0)
  const anchor = useRef(null)
  const panel = useRef(null)
  const closeTimer = useRef(null)
  const id = useId()
  const path = peoplePath(storyId, chapterId, commentId, emoji)
  const key = `${path}:${count}:${retry}`
  const data = result?.key === key ? result.data : null
  const error = result?.key === key ? result.error : null
  const show = () => { clearTimeout(closeTimer.current); setOpen(true) }
  const delayClose = () => { clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), 200) }
  useEffect(() => () => clearTimeout(closeTimer.current), [])
  useEffect(() => {
    if (!open) return undefined
    let active = true
    api.get(path).then(({ data }) => { if (active) setResult({ key, data }) }).catch(failure => { if (active) setResult({ key, error: authError(failure) }) })
    return () => { active = false }
  }, [open, path, key])
  useLayoutEffect(() => {
    if (!open) return undefined
    const update = () => {
      const target = anchor.current, element = panel.current
      if (!target || !element) return
      const bounds = target.getBoundingClientRect()
      const width = document.documentElement.clientWidth
      const height = window.visualViewport?.height || window.innerHeight
      const left = Math.max(16, Math.min(bounds.left, width - element.offsetWidth - 16))
      const top = Math.max(16, bounds.bottom + 6)
      element.style.maxHeight = `${Math.max(0, height - top - 16)}px`
      element.style.left = `${left}px`; element.style.top = `${top}px`; element.style.visibility = 'visible'
    }
    update()
    const observer = new ResizeObserver(update)
    if (panel.current) observer.observe(panel.current)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    window.visualViewport?.addEventListener('resize', update)
    const outside = event => { if (!anchor.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false) }
    const escape = event => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); window.visualViewport?.removeEventListener('resize', update); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  const leaveFocus = event => {
    if (!anchor.current?.contains(event.relatedTarget) && !panel.current?.contains(event.relatedTarget)) delayClose()
  }
  return <span ref={anchor} onPointerEnter={event => { if (event.pointerType !== 'touch') show() }} onPointerLeave={event => { if (event.pointerType !== 'touch') delayClose() }} onFocus={show} onBlur={leaveFocus}
    className={`inline-flex items-center rounded-full border text-sm ${selected ? 'border-blue-500 bg-blue-100 text-blue-900 dark:border-blue-400 dark:bg-blue-900 dark:text-blue-100' : 'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'}`}>
    <button type="button" disabled={disabled} onClick={onReact} aria-pressed={selected} aria-label={`${emoji}${selected ? ': remove your reaction' : ': react to this comment'}`}
      className="rounded-l-full py-1 pl-2.5 pr-1 text-lg hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 dark:hover:bg-slate-800">{emoji}</button>
    <button type="button" onClick={show} aria-label={`See ${count} ${count === 1 ? 'person' : 'people'} who reacted with ${emoji}`} aria-expanded={open} aria-controls={open ? id : undefined}
      className="rounded-r-full py-1.5 pl-1 pr-2.5 font-semibold hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800">{count}</button>
    {open && createPortal(<div ref={panel} id={id} role="dialog" aria-label={`People who reacted with ${emoji}`} onPointerEnter={show} onPointerLeave={event => { if (event.pointerType !== 'touch') delayClose() }} onFocus={show} onBlur={leaveFocus}
      style={{ visibility: 'hidden' }} className="fixed z-50 w-[min(17rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-blue-200 bg-white p-3 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <p className="mb-2 px-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Reacted with {emoji}</p>
      {!data && !error && <p role="status" className="px-2 py-2 text-sm">Loading people…</p>}
      {error && <div role="alert" className="px-2 text-sm"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 font-semibold text-blue-700 dark:text-blue-300">Try again</button></div>}
      {data && <><People users={data.users} onProfile={onProfile} />{!data.users.length && <p className="px-2 text-sm text-slate-500">No one is using this reaction now.</p>}{data.hasMore && <button type="button" onClick={() => { setOpen(false); onViewMore() }} className="mt-2 w-full rounded-lg border-t border-slate-200 px-2 py-2 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800">View more · {data.total} people</button>}</>}
    </div>, document.body)}
  </span>
}

export const ReactionUsersDialog = ({ emoji, storyId, chapterId, commentId, onProfile, onClose }) => {
  const dialog = useRef(null)
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [pages, setPages] = useState({})
  const [failure, setFailure] = useState(null)
  const id = useId()
  const path = peoplePath(storyId, chapterId, commentId, emoji, page, 50)
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    element.showModal(); document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => {
    let active = true
    api.get(path).then(({ data }) => { if (active) setPages(current => ({ ...current, [page]: data })) })
      .catch(error => { if (active) setFailure({ page, retry, message: authError(error) }) })
    return () => { active = false }
  }, [path, page, retry])
  const data = pages[page]
  const error = !data && failure?.page === page && failure.retry === retry ? failure.message : null
  const users = [...new Map(Object.keys(pages).sort((a, b) => Number(a) - Number(b)).flatMap(key => pages[key].users).map(user => [user.id, user])).values()]
  return <dialog ref={dialog} aria-labelledby={`${id}-heading`} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}
    className="m-auto max-h-[85dvh] w-[min(30rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-3xl border border-blue-100 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-black/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 id={`${id}-heading`} className="text-lg font-bold">People who reacted {emoji}</h2><button autoFocus type="button" onClick={onClose} aria-label="Close reaction list" className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><FiX /></button></div>
    <People users={users} onProfile={onProfile} />
    {!data && !error && <p role="status" className="mt-4 text-sm">Loading people…</p>}
    {error && <div role="alert" className="mt-4 text-sm"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 font-semibold text-blue-700 dark:text-blue-300">Try again</button></div>}
    {data && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Showing {users.length} of {data.total}</p>}
    {data?.hasMore && <button type="button" onClick={() => setPage(current => current + 1)} className="mt-4 w-full rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">Load more</button>}
  </dialog>
}
