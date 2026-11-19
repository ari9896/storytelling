import { useEffect, useRef } from 'react'
import { restoreReadingPosition } from '../lib/restoreReadingPosition.js'

const ChapterText = ({ text, chapterId, resumeParagraphIndex, onParagraphChange, scrollRef, readerRef, suspended }) => {
  const root = useRef(null)
  const restored = useRef(false)
  const current = useRef(null)
  const trackNow = useRef(null)
  const callback = useRef(onParagraphChange)
  const paused = useRef(suspended)
  useEffect(() => { callback.current = onParagraphChange; paused.current = suspended }, [onParagraphChange, suspended])
  useEffect(() => { if (!suspended) trackNow.current?.() }, [suspended])
  useEffect(() => {
    const element = root.current
    let timer, frame, secondFrame, highlightTimer
    let initialized = false
    const paragraphs = Array.from(element.querySelectorAll('[data-paragraph-index]'))
    const save = index => {
      if (index === current.current) return
      current.current = index
      clearTimeout(timer)
      timer = setTimeout(() => { callback.current?.(chapterId, index); timer = null }, 600)
    }
    const track = () => {
      if (!initialized || paused.current || document.hidden) return
      const container = scrollRef.current
      const box = container.getBoundingClientRect()
      const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--site-header-height')) || 0
      const top = Math.max(header + 16, box.top)
      const bottom = Math.min(window.innerHeight, box.bottom)
      if (bottom <= top) return
      const line = top + Math.min(80, (bottom - top) / 4)
      const index = paragraphs.findIndex(paragraph => {
        const bounds = paragraph.getBoundingClientRect()
        return bounds.bottom > line && bounds.top < bottom
      })
      if (index >= 0) save(index)
    }
    trackNow.current = track
    const observer = new ResizeObserver(track)
    observer.observe(element)
    frame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => {
      if (!restored.current && Number.isInteger(resumeParagraphIndex)) {
        const index = Math.min(Math.max(0, resumeParagraphIndex), paragraphs.length - 1)
        const paragraph = paragraphs[index]
        if (paragraph) {
          restoreReadingPosition(paragraph, scrollRef.current, readerRef.current)
          paragraph.classList.add('resumed-paragraph')
          highlightTimer = setTimeout(() => paragraph.classList.remove('resumed-paragraph'), 3000)
        }
      }
      restored.current = true
      initialized = true
      track()
    }) })
    window.addEventListener('scroll', track, true)
    window.addEventListener('resize', track)
    const visibility = () => { if (document.hidden && timer && current.current !== null) { clearTimeout(timer); timer = null; callback.current?.(chapterId, current.current) } }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      observer.disconnect(); trackNow.current = null; clearTimeout(highlightTimer)
      cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame)
      window.removeEventListener('scroll', track, true); window.removeEventListener('resize', track)
      document.removeEventListener('visibilitychange', visibility)
      if (timer && current.current !== null) { clearTimeout(timer); callback.current?.(chapterId, current.current) }
    }
  }, [chapterId, scrollRef, readerRef, resumeParagraphIndex])
  return <div ref={root} className="mt-6 space-y-6 text-lg leading-8 text-slate-700 dark:text-slate-200">
    {text.split(/\n\s*\n/u).filter(paragraph => paragraph.trim()).map((paragraph, index) => <p key={index} data-paragraph-index={index} className="rounded-lg whitespace-pre-line break-words" style={{ scrollMarginTop: 'calc(var(--site-header-height, 8rem) + 1rem)' }}>{paragraph}</p>)}
  </div>
}
export default ChapterText
