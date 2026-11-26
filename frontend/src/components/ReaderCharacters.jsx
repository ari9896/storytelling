import { useEffect, useId, useRef, useState } from 'react'
import { FiChevronLeft, FiChevronRight, FiUser, FiX } from 'react-icons/fi'

const CharacterCard = ({ character, onClose }) => {
  const dialog = useRef(null)
  const heading = useId()
  const [imageIndex, setImageIndex] = useState(0)
  const images = character.images || []
  const image = images[imageIndex]
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={dialog} aria-labelledby={heading} onCancel={onClose} onClick={event => {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
  }} className="user-details-dialog m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-3xl border border-blue-100 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-black/65 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-8">
    <div className="mb-5 flex items-start justify-between gap-4"><h2 id={heading} className="break-words text-2xl font-bold">{character.name || 'Unnamed character'}</h2><button autoFocus type="button" onClick={onClose} aria-label="Close character profile" className="shrink-0 rounded-full p-2 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800"><FiX /></button></div>
    {image && <figure>
      <div className="relative overflow-hidden rounded-2xl bg-slate-950"><img src={image.url} alt={image.alt || character.name || 'Character picture'} className="h-72 w-full object-contain sm:h-96" />
        {images.length > 1 && <><button type="button" aria-label="Previous character picture" onClick={() => setImageIndex(index => (index - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-3 text-white hover:bg-black"><FiChevronLeft /></button><button type="button" aria-label="Next character picture" onClick={() => setImageIndex(index => (index + 1) % images.length)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-3 text-white hover:bg-black"><FiChevronRight /></button></>}
      </div>
      {images.length > 1 && <p aria-live="polite" className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">Picture {imageIndex + 1} of {images.length}</p>}
      {image.explanation && <figcaption className="mt-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{image.explanation}</figcaption>}
    </figure>}
    <div className="mt-6 whitespace-pre-wrap break-words text-base leading-8">{character.intro || 'An introduction is coming soon.'}</div>
  </dialog>
}

const ReaderCharacters = ({ characters = [], visible = true, children }) => {
  const [selectedId, setSelectedId] = useState(null)
  const selected = characters.find(character => character.id === selectedId)
  const shown = visible && characters.length > 0
  return <>
    <div className={shown ? 'xl:-ml-[7.5rem] xl:grid xl:grid-cols-[6.5rem_minmax(0,1fr)] xl:items-start xl:gap-4' : ''}>
      {shown && <aside aria-label="Story characters" className="mb-5 rounded-2xl border border-blue-200 bg-white/95 p-2 shadow-md dark:border-slate-700 dark:bg-slate-900/95 xl:sticky xl:top-[calc(var(--site-header-height,8rem)+1rem)]">
        <h2 className="mb-2 px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Characters</h2>
        <div className="flex flex-wrap gap-2 xl:flex-col">{characters.map(character => <button key={character.id} type="button" onClick={() => setSelectedId(character.id)} aria-haspopup="dialog" title={character.name || 'Unnamed character'} className="flex min-w-20 flex-col items-center gap-1 rounded-xl p-2 text-slate-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-200 dark:hover:bg-slate-800">
          {character.images?.[0] ? <img src={character.images[0].url} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <FiUser aria-hidden="true" className="h-9 w-9 p-1" />}
          <span className="w-16 truncate text-xs font-semibold">{character.name || 'Unnamed character'}</span>
        </button>)}</div>
      </aside>}
      <div className="min-w-0">{children}</div>
    </div>
    {selected && <CharacterCard key={selected.id} character={selected} onClose={() => setSelectedId(null)} />}
  </>
}
export default ReaderCharacters
