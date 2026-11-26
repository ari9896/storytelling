import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiArrowDown, FiArrowUp, FiMenu } from 'react-icons/fi'

const ChapterOrderList = ({ chapters, selectedId, onSelect, onReorder, disabled = false }) => {
  const [drag, setDrag] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const active = useRef(null)
  const frame = useRef(null)
  const list = useRef(null)
  const hintId = useId()
  const cancel = () => {
    const previous = active.current
    active.current = null
    cancelAnimationFrame(frame.current)
    setDrag(null)
    if (previous?.element.hasPointerCapture(previous.pointerId)) previous.element.releasePointerCapture(previous.pointerId)
  }
  useEffect(() => {
    const stop = () => {
      const previous = active.current
      active.current = null
      cancelAnimationFrame(frame.current)
      if (previous?.element.hasPointerCapture(previous.pointerId)) previous.element.releasePointerCapture(previous.pointerId)
      setDrag(null)
    }
    window.addEventListener('blur', stop)
    return () => { window.removeEventListener('blur', stop); active.current = null; cancelAnimationFrame(frame.current) }
  }, [])
  const targetAt = (x, y) => {
    const target = document.elementFromPoint(x, y)?.closest('[data-chapter-order-id]')
    return target && list.current?.contains(target) ? target.dataset.chapterOrderId : null
  }
  const announceMove = (sourceId, targetId) => {
    const from = chapters.findIndex(item => item.id === sourceId)
    const to = chapters.findIndex(item => item.id === targetId)
    if (disabled || from < 0 || to < 0 || from === to) return
    onReorder(sourceId, targetId)
    setAnnouncement(`Moved ${chapters[from].title.trim() || `Chapter ${from + 1}`} to Chapter ${to + 1}. Save to keep this order.`)
  }
  const tick = () => {
    const current = active.current
    if (!current) return
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--site-header-height')) || 0
    if (current.y < header + 60) window.scrollBy(0, -12)
    else if (current.y > window.innerHeight - 60) window.scrollBy(0, 12)
    const targetId = targetAt(current.x, current.y)
    if (targetId) current.targetId = targetId
    setDrag(previous => previous?.targetId === current.targetId && previous?.x === current.x && previous?.y === current.y ? previous : {
      sourceId: current.sourceId, targetId: current.targetId, x: current.x, y: current.y,
    })
    frame.current = requestAnimationFrame(tick)
  }
  const start = (event, sourceId) => {
    if (active.current || disabled || !event.isPrimary || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    active.current = { sourceId, targetId: sourceId, pointerId: event.pointerId, element: event.currentTarget, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ sourceId, targetId: sourceId, x: event.clientX, y: event.clientY })
    frame.current = requestAnimationFrame(tick)
  }
  const move = event => {
    if (active.current?.pointerId !== event.pointerId) return
    active.current.x = event.clientX; active.current.y = event.clientY
  }
  const drop = event => {
    const current = active.current
    if (!current || current.pointerId !== event.pointerId) return
    const target = targetAt(event.clientX, event.clientY)
    const sourceId = current.sourceId
    cancel()
    if (target) announceMove(sourceId, target)
  }
  const draggedChapter = drag ? chapters.find(chapter => chapter.id === drag.sourceId) : null
  return <div className="w-full">
    <p id={hintId} className="mb-3 text-xs text-slate-500 dark:text-slate-400">Drag a chapter’s handle to reorder, or use the arrow buttons. Numbers update automatically. Save to keep the new order.</p>
    <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
    <div ref={list} className="grid w-full gap-3 sm:grid-cols-2">{chapters.map((item, index) => <div key={item.id} data-chapter-order-id={item.id}
      className={`min-w-0 rounded-2xl border p-3 transition-colors ${drag?.targetId === item.id && drag.sourceId !== item.id ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-400 dark:bg-blue-950' : selectedId === item.id ? 'border-blue-400 bg-blue-50 dark:bg-slate-800' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'} ${drag?.sourceId === item.id ? 'opacity-50' : ''}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" disabled={disabled} aria-label={`Drag Chapter ${index + 1} to reorder`} aria-describedby={hintId}
          onPointerDown={event => start(event, item.id)} onPointerMove={move} onPointerUp={drop} onPointerCancel={cancel} onLostPointerCapture={() => { if (active.current) cancel() }}
          onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); cancel() }
            if (event.key === 'ArrowUp' && index > 0) { event.preventDefault(); announceMove(item.id, chapters[index - 1].id) }
            if (event.key === 'ArrowDown' && index < chapters.length - 1) { event.preventDefault(); announceMove(item.id, chapters[index + 1].id) }
          }} className="inline-flex min-h-10 min-w-10 touch-none select-none items-center justify-center rounded-lg text-slate-500 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700 cursor-grab active:cursor-grabbing"><FiMenu aria-hidden="true" /></button>
        <div className="flex gap-1"><button type="button" disabled={disabled || index === 0} onClick={() => announceMove(item.id, chapters[index - 1].id)} aria-label={`Move Chapter ${index + 1} up`} className="rounded-lg p-2 text-blue-700 hover:bg-blue-100 disabled:opacity-30 dark:text-blue-300 dark:hover:bg-slate-700"><FiArrowUp /></button>
          <button type="button" disabled={disabled || index === chapters.length - 1} onClick={() => announceMove(item.id, chapters[index + 1].id)} aria-label={`Move Chapter ${index + 1} down`} className="rounded-lg p-2 text-blue-700 hover:bg-blue-100 disabled:opacity-30 dark:text-blue-300 dark:hover:bg-slate-700"><FiArrowDown /></button></div>
      </div>
      <button type="button" disabled={disabled} onClick={() => onSelect(index)} aria-current={selectedId === item.id ? 'step' : undefined} className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl p-1 text-left focus-visible:outline-2 focus-visible:outline-blue-600">
        <span className="min-w-0 flex-1"><span className="block text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Chapter {index + 1} · {item.status === 'draft' ? 'Draft' : 'Published'}</span><span className="mt-1 block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title.trim() || 'Untitled chapter'}</span></span>
        <span className="flex shrink-0 gap-1.5" aria-label={`${item.images.length} of 5 pictures`}>{item.images.length ? item.images.slice(0, 5).map((picture, pictureIndex) => <img key={picture.id} src={picture.url} alt={`Chapter ${index + 1}, picture ${pictureIndex + 1}`} draggable={false} className="h-8 w-8 rounded-md border border-slate-200 bg-white object-cover dark:border-slate-700 dark:bg-slate-900" />) : <span aria-hidden="true" className="h-8 w-8 rounded-md border-2 border-dotted border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800" />}</span>
      </button>
    </div>)}</div>
    {drag && draggedChapter && createPortal(<div aria-hidden="true" style={{ left: drag.x + 12, top: drag.y + 12 }} className="pointer-events-none fixed z-50 max-w-64 truncate rounded-xl border border-blue-300 bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-xl">{draggedChapter.title.trim() || 'Untitled chapter'}</div>, document.body)}
  </div>
}
export default ChapterOrderList
