import { useEffect, useId, useRef, useState } from 'react'
import { FiX } from 'react-icons/fi'
import { cropGeometry, exportCroppedImage } from '../lib/imageCrop.js'

const ImageCropper = ({ file, previewUrl, title = 'Adjust picture', aspect = 'original', onConfirm, onCancel }) => {
  const dialog = useRef(null)
  const viewport = useRef(null)
  const image = useRef(null)
  const drag = useRef(null)
  const [size, setSize] = useState(null)
  const [box, setBox] = useState({ width: 1, height: 1 })
  const [cropping, setCropping] = useState(false)
  const [ratio, setRatio] = useState(aspect)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const id = useId()
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    const observer = new ResizeObserver(() => {
      const bounds = viewport.current.getBoundingClientRect()
      setBox({ width: bounds.width, height: bounds.height })
    })
    observer.observe(viewport.current)
    return () => { observer.disconnect(); element.close(); document.body.style.overflow = overflow; previousFocus?.focus({ preventScroll: true }) }
  }, [])
  const naturalAspect = size ? size.width / size.height : 1
  const geometry = cropGeometry({ width: size?.width || 1, height: size?.height || 1, boxWidth: box.width, boxHeight: box.height,
    aspect: ratio === 'original' ? naturalAspect : Number(ratio), zoom, offset })
  const reset = () => { setCropping(false); setZoom(1); setOffset({ x: 0, y: 0 }); setError('') }
  const confirm = async () => {
    if (busy.current || !size) return
    busy.current = true
    setProcessing(true)
    setError('')
    try { onConfirm(cropping ? await exportCroppedImage(image.current, file, geometry.source) : file) }
    catch (failure) { setError(failure.message); busy.current = false; setProcessing(false) }
  }
  const startDrag = event => {
    if (!cropping || !event.isPrimary || event.button !== 0) return
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, offset: { x: geometry.x, y: geometry.y } }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = event => {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    const next = cropGeometry({ width: size.width, height: size.height, boxWidth: box.width, boxHeight: box.height,
      aspect: ratio === 'original' ? naturalAspect : Number(ratio), zoom, offset: { x: current.offset.x + event.clientX - current.x, y: current.offset.y + event.clientY - current.y } })
    setOffset({ x: next.x, y: next.y })
  }
  const keyboardPan = event => {
    if (!cropping || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const step = event.shiftKey ? 40 : 10
    setOffset({ x: geometry.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
      y: geometry.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) })
  }
  return <dialog ref={dialog} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); if (!busy.current) onCancel() }}
    className="m-auto max-h-[92dvh] w-[min(42rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-black/65 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-6">
    <div className="flex items-center justify-between gap-4"><h2 id={`${id}-title`} className="text-xl font-bold">{title}</h2><button type="button" disabled={processing} onClick={onCancel} aria-label="Cancel picture selection" className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><FiX /></button></div>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Keep the full picture, or zoom in and drag to choose the part you want.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={processing} aria-pressed={!cropping} onClick={reset} className={`rounded-full border px-4 py-2 text-sm font-semibold ${!cropping ? 'border-blue-500 bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100' : 'border-slate-300 dark:border-slate-600'}`}>Full picture</button>
      <button type="button" disabled={!size || processing} aria-pressed={cropping} onClick={() => setCropping(true)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${cropping ? 'border-blue-500 bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100' : 'border-slate-300 dark:border-slate-600'}`}>Crop &amp; zoom</button>
    </div>
    <div ref={viewport} className="mt-4 flex h-[min(45dvh,24rem)] items-center justify-center rounded-2xl bg-slate-950/90">
      <div tabIndex={cropping ? 0 : undefined} role={cropping ? 'group' : undefined} aria-label={cropping ? 'Crop preview. Drag or use arrow keys to reposition the picture.' : undefined}
        onKeyDown={keyboardPan} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}
        className={`relative overflow-hidden ${cropping ? 'touch-none cursor-grab border border-white/70 active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-blue-400' : 'h-full w-full'}`}
        style={cropping ? { width: geometry.frameWidth, height: geometry.frameHeight } : undefined}>
        {previewUrl && <img ref={image} src={previewUrl} alt="Picture preview" draggable={false} onLoad={event => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setError('This image could not be opened. Please choose another picture.')}
          className={cropping ? 'pointer-events-none absolute max-w-none select-none' : 'h-full w-full object-contain'}
          style={cropping ? { width: geometry.imageWidth, height: geometry.imageHeight, left: '50%', top: '50%', transform: `translate(-50%, -50%) translate(${geometry.x}px, ${geometry.y}px)` } : undefined} />}
      </div>
    </div>
    <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
      <label className="text-sm font-semibold" htmlFor={`${id}-zoom`}>Zoom · {Math.round(zoom * 100)}%
        <input id={`${id}-zoom`} type="range" min="1" max="4" step="0.01" value={zoom} disabled={!size || processing} aria-valuetext={`${Math.round(zoom * 100)} percent`} onChange={event => { setCropping(true); setZoom(Number(event.target.value)); setOffset({ x: geometry.x, y: geometry.y }) }} className="mt-2 block w-full accent-blue-600" />
      </label>
      <label className="text-sm font-semibold" htmlFor={`${id}-shape`}>Crop shape
        <select id={`${id}-shape`} value={ratio} disabled={!size || processing} onChange={event => { setRatio(event.target.value); setCropping(true); setOffset({ x: 0, y: 0 }) }} className="mt-2 block rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
          <option value="original">Original proportions</option><option value="1">Square</option><option value={16 / 9}>Landscape</option><option value={4 / 5}>Portrait</option>
        </select>
      </label>
    </div>
    {cropping && file.type === 'image/gif' && <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">Cropping saves a still picture. Choose Full picture to keep the GIF animated.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
    <div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" disabled={processing} onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold dark:border-slate-600">Cancel</button><button type="button" disabled={!size || processing} onClick={confirm} className="rounded-xl bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{processing ? 'Preparing…' : cropping ? 'Use cropped picture' : 'Use original picture'}</button></div>
  </dialog>
}
export default ImageCropper
