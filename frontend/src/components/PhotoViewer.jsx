import { useEffect, useRef, useState } from 'react'
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi'

const PhotoViewer = ({ images, initialIndex, title, onClose }) => {
  const [index, setIndex] = useState(initialIndex)
  const [zoomed, setZoomed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const drag = useRef(null)
  const suppressClick = useRef(false)
  const viewport = useRef(null)
  const dialog = useRef(null)
  const image = images[index]
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = overflow
      previousFocus?.focus()
    }
  }, [])
  const resetScroll = () => requestAnimationFrame(() => viewport.current?.scrollTo({ left: 0, top: 0 }))
  const move = direction => {
    setIndex(current => (current + direction + images.length) % images.length)
    setZoomed(false)
    drag.current = null
    setDragging(false)
    resetScroll()
  }
  const toggleZoom = () => {
    setZoomed(current => !current)
    requestAnimationFrame(() => {
      const area = viewport.current
      if (!area) return
      area.scrollTo({ left: zoomed ? 0 : (area.scrollWidth - area.clientWidth) / 2, top: zoomed ? 0 : (area.scrollHeight - area.clientHeight) / 2 })
    })
  }
  const startDrag = event => {
    suppressClick.current = false
    if (!zoomed || event.button !== 0 || !event.isPrimary) return
    const area = viewport.current
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: area.scrollLeft, top: area.scrollTop, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }
  const panImage = event => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (!current.moved && Math.hypot(dx, dy) < 5) return
    current.moved = true
    suppressClick.current = true
    viewport.current.scrollLeft = current.left - dx
    viewport.current.scrollTop = current.top - dy
  }
  const stopDrag = event => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    suppressClick.current = current.moved || event.type !== 'pointerup'
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const clickPhoto = event => {
    if (event.detail !== 0 && suppressClick.current) {
      suppressClick.current = false
      return
    }
    toggleZoom()
  }
  return <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }} onKeyDown={event => {
    if (zoomed || images.length < 2) return
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
  }} aria-label={`${title} enlarged photos`} className="photo-viewer m-auto h-[92dvh] max-h-none w-[96vw] max-w-7xl overflow-visible border-0 bg-transparent p-0 text-white outline-none">
    <div className="pointer-events-none flex h-full flex-col">
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-4 px-2">
        <p className="truncate text-sm font-medium">{title}</p>
        <button autoFocus type="button" onClick={onClose} aria-label="Close enlarged photo" className="pointer-events-auto rounded-full bg-black/60 p-3 text-xl hover:bg-black focus-visible:outline-2 focus-visible:outline-white"><FiX aria-hidden="true" /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-1 sm:px-16">
        <div ref={viewport} className="pointer-events-auto h-full w-full overflow-auto overscroll-contain">
          <button type="button" onClick={clickPhoto} onPointerDown={startDrag} onPointerMove={panImage} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag} style={{ touchAction: zoomed ? 'none' : 'auto' }} aria-label={zoomed ? 'Zoom out photo' : 'Zoom in photo'} aria-pressed={zoomed} className={`block border-0 p-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white ${zoomed ? `h-[200%] w-[200%] max-w-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}` : 'h-full w-full cursor-zoom-in'}`}>
            <img src={image.url} draggable={false} alt={image.alt || `${title}, image ${index + 1}`} className="h-full w-full max-w-none select-none object-contain" />
          </button>
        </div>
        {images.length > 1 && <>
          <button type="button" onClick={() => move(-1)} aria-label="Previous photo" className="pointer-events-auto absolute left-1 rounded-full bg-black/70 p-3 text-2xl hover:bg-black focus-visible:outline-2 focus-visible:outline-white"><FiChevronLeft aria-hidden="true" /></button>
          <button type="button" onClick={() => move(1)} aria-label="Next photo" className="pointer-events-auto absolute right-1 rounded-full bg-black/70 p-3 text-2xl hover:bg-black focus-visible:outline-2 focus-visible:outline-white"><FiChevronRight aria-hidden="true" /></button>
        </>}
      </div>
      {image.explanation && <div className="pointer-events-auto mx-auto mt-3 max-h-[20dvh] w-full max-w-3xl shrink-0 overflow-y-auto rounded-xl bg-black/50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wider text-white/60">About this picture</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/90">{image.explanation}</p></div>}
      <p aria-live="polite" className="shrink-0 py-3 text-center text-sm text-white/80">{index + 1} / {images.length} · {zoomed ? '200% · Drag to explore; click to zoom out' : 'Click photo to zoom in'}</p>
    </div>
  </dialog>
}

export default PhotoViewer
