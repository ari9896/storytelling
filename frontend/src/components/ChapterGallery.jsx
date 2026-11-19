import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { useState } from 'react'
import PhotoViewer from './PhotoViewer.jsx'
import ImageBackdrop from './ImageBackdrop.jsx'

const ChapterGallery = ({ images, title, onExplanationChange }) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const [pinned, setPinned] = useState(null)
  const [viewingIndex, setViewingIndex] = useState(null)
  const move = direction => {
    const next = (activeIndex + direction + images.length) % images.length
    setActiveIndex(next)
    if (pinned !== null && images[next].explanation) {
      setPinned(next)
      onExplanationChange?.({ text: images[next].explanation, index: next })
    } else {
      setPinned(null)
      onExplanationChange?.(null)
    }
  }
  return (
  <>
  <div className="flex min-h-0 flex-col bg-indigo-950 md:h-full">
    <div role="region" aria-roledescription="carousel" aria-label={`${title} image gallery`} onKeyDown={event => {
      if (images.length < 2) return
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
    }} className="relative h-72 min-h-0 overflow-hidden md:h-full md:flex-1">
      <div className="absolute inset-0 flex transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
      {images.map((image, index) => <figure key={`${image.url}-${index}`} inert={index !== activeIndex} aria-hidden={index !== activeIndex} className="relative isolate h-full w-full shrink-0 overflow-hidden">
        <button type="button" onMouseEnter={() => { if (pinned === null) onExplanationChange?.(image.explanation ? { text: image.explanation, index } : null) }} onMouseLeave={() => { if (pinned === null) onExplanationChange?.(null) }} onFocus={() => onExplanationChange?.(image.explanation ? { text: image.explanation, index } : null)} onBlur={() => { if (pinned === null) onExplanationChange?.(null) }} onClick={() => setViewingIndex(index)} aria-label={`Enlarge ${title}, photo ${index + 1}`} className="relative block h-full w-full cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white">
        <ImageBackdrop src={image.url} />
        <img src={image.url} alt={image.alt || `${title}, image ${index + 1}`} className="relative h-full w-full object-contain" />
        </button>
        {image.explanation && <button type="button" aria-pressed={pinned === index} onClick={() => { const next = pinned === index ? null : index; setPinned(next); onExplanationChange?.(next === null ? null : { text: image.explanation, index }) }} className="absolute bottom-4 left-4 rounded-full bg-slate-950/80 px-3 py-2 text-xs font-semibold text-white hover:bg-black">{pinned === index ? 'Back to chapter' : 'About this picture'}</button>}
        {images.length > 1 && <figcaption className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-slate-950/75 px-3 py-1 text-xs font-semibold text-white">{index + 1} / {images.length}</figcaption>}
      </figure>)}
      </div>
      {images.length > 1 && <>
        <button type="button" onClick={() => move(-1)} aria-label="Previous image" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-slate-950/70 p-3 text-xl text-white shadow-lg hover:bg-black focus-visible:outline-2 focus-visible:outline-white"><FiChevronLeft aria-hidden="true" /></button>
        <button type="button" onClick={() => move(1)} aria-label="Next image" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-slate-950/70 p-3 text-xl text-white shadow-lg hover:bg-black focus-visible:outline-2 focus-visible:outline-white"><FiChevronRight aria-hidden="true" /></button>
      </>}
    </div>
  </div>
  <span aria-live="polite" className="sr-only">Picture {activeIndex + 1} of {images.length}</span>
  {viewingIndex !== null && <PhotoViewer images={images} initialIndex={viewingIndex} title={title} onClose={() => setViewingIndex(null)} />}
  </>
  )
}

export default ChapterGallery
