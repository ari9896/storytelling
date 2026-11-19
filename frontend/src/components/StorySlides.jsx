import ChapterText from './ChapterText.jsx'
import MoreComingPrompt from './MoreComingPrompt.jsx'
import ChapterGallery from './ChapterGallery.jsx'
import { useAuth } from '../context/auth.js'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiList, FiMaximize2, FiMinimize2, FiX } from 'react-icons/fi'

const StorySlides = ({ story, onSlideChange, canOpenSlide, initialIndex = 0, following = false, onParagraphChange, resumeParagraphIndex = null }) => {
  const { user, loading, requireAccount } = useAuth()
  const firstChapterIndex = story.slides.findIndex(item => item.type === 'story')
  const [selectedIndex, setSlideIndex] = useState(initialIndex)
  const slideIndex = !user && selectedIndex > firstChapterIndex ? firstChapterIndex : selectedIndex
  const [initialBookmark] = useState(() => ({ chapterId: story.slides[initialIndex]?.chapterId, paragraphIndex: resumeParagraphIndex }))
  const [showMoreComing, setShowMoreComing] = useState(false)
  const [imageExplanation, setImageExplanation] = useState(null)
  const [readingView, setReadingView] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)
  const [titleScrolled, setTitleScrolled] = useState(false)
  const [showChapterList, setShowChapterList] = useState(false)
  const [hasEnteredStory, setHasEnteredStory] = useState(story.slides[0].type !== 'note')
  const pendingScroll = useRef(false)
  const sectionRef = useRef(null)
  const textRef = useRef(null)
  const titleRef = useRef(null)
  const timersRef = useRef([])
  const slide = story.slides[slideIndex]
  const images = slide.images?.length ? slide.images : slide.image ? [{ url: slide.image, alt: story.coverAlt }] : []
  const isFirst = slideIndex === 0
  const availableChapters = story.availableChapterCount || story.slides.filter(item => item.type === 'story').length
  const plannedChapters = story.plannedChapterCount || null
  const moreComing = !plannedChapters || plannedChapters > availableChapters
  const isLast = slideIndex === story.slides.length - 1

  const goToSlide = (nextIndex) => {
    if (isRevealing || nextIndex < 0 || nextIndex >= story.slides.length) return
    if (nextIndex > firstChapterIndex && !requireAccount('Sign up to read beyond the first chapter.')) return
    if (canOpenSlide) {
      const access = canOpenSlide(nextIndex)
      if (access !== true) {
        if (typeof access !== 'number') return
        nextIndex = access
      }
    }
    if (textRef.current) textRef.current.scrollTop = 0
    setImageExplanation(null)
    setTitleScrolled(false)
    pendingScroll.current = true
    setSlideIndex(nextIndex)
    if (story.slides[nextIndex].type === 'story') setHasEnteredStory(true)
    onSlideChange(nextIndex)
  }

  useLayoutEffect(() => {
    if (!pendingScroll.current) return
    pendingScroll.current = false
    if (textRef.current) textRef.current.scrollTop = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    sectionRef.current?.scrollIntoView({ behavior: isRevealing || reducedMotion ? 'instant' : 'smooth', block: 'start' })
  }, [slideIndex, isRevealing])

  const handleTextScroll = (event) => {
    if (!titleRef.current) return
    setTitleScrolled(titleRef.current.getBoundingClientRect().bottom <= event.currentTarget.getBoundingClientRect().top)
  }

  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  const beginStory = () => {
    if (isRevealing) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      goToSlide(slideIndex + 1)
      return
    }

    setIsRevealing(true)
    timersRef.current = [
      setTimeout(() => {
        const nextIndex = slideIndex + 1
        pendingScroll.current = true
        setSlideIndex(nextIndex)
        setTitleScrolled(false)
        onSlideChange(nextIndex)
      }, 1100),
      setTimeout(() => {
        setIsRevealing(false)
        setHasEnteredStory(true)
        timersRef.current = []
      }, 3000),
    ]
  }

  return (
    <>
    <section ref={sectionRef} aria-label={`${story.title} slides`} aria-busy={isRevealing} className="scroll-mt-[calc(var(--site-header-height,8rem)+1rem)]">
      <div className="relative">
      {showChapterList ? (
        <article className="min-h-[32rem] rounded-3xl border border-blue-100 dark:border-slate-700 bg-white dark:bg-slate-900 px-7 py-9 shadow-lg shadow-blue-900/5 sm:px-12 md:h-[36rem] md:overflow-y-auto">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">{story.title}</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Chapters</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Choose a part of the story to read.</p>
            </div>
            <button type="button" onClick={() => setShowChapterList(false)} aria-label="Return to current slide" className="rounded-full border border-blue-200 dark:border-blue-900 p-2.5 text-blue-700 dark:text-blue-300 transition hover:bg-blue-50 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-700"><FiX aria-hidden="true" /></button>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {story.slides.map((item, index) => <button key={`${item.type}-${index}`} type="button" onClick={() => { goToSlide(index); setShowChapterList(false) }} aria-current={index === slideIndex ? 'step' : undefined}
              className={`flex min-h-24 items-center gap-4 rounded-2xl border px-5 py-4 text-left transition hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-700 ${index === slideIndex ? 'border-blue-400 bg-blue-50 dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950 text-sm font-bold text-blue-700 dark:text-blue-300">{item.type === 'note' ? <FiBookOpen aria-hidden="true" /> : item.chapter}</span>
              <span className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">{item.type === 'note' ? 'Storyteller’s note' : `Chapter ${item.chapter}`}</span>
                <span className="mt-1 block font-semibold text-slate-900 dark:text-slate-100">{item.title}{item.locked ? ' · Locked' : ''}</span>
              </span>
            </button>)}
          </div>
        </article>
      ) : slide.type === 'note' ? (
        <article className="relative flex min-h-[32rem] flex-col justify-center rounded-3xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 px-8 py-12 shadow-lg shadow-blue-900/5 sm:px-14">
          {hasEnteredStory && <button type="button" onClick={() => setShowChapterList(true)} className="absolute right-6 top-6 inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-900 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-700"><FiList aria-hidden="true" /> Chapters</button>}
          <div className="mx-auto w-full max-w-2xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-950 text-2xl text-blue-700 dark:text-blue-300"><FiBookOpen aria-hidden="true" /></div>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.22em] text-blue-700 dark:text-blue-300">Before the story</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{slide.title}</h2>
            <p className="mt-6 whitespace-pre-line text-lg leading-8 text-slate-700 dark:text-slate-200">{slide.text}</p>
          </div>
        </article>
      ) : (
        <article className={`${readingView ? 'px-8 py-10 md:px-12' : 'grid overflow-hidden md:h-[36rem] md:grid-cols-2'} min-h-[32rem] rounded-3xl bg-white dark:bg-slate-900 shadow-lg shadow-blue-900/5`}>
          {!readingView && (images.length ? <ChapterGallery key={slideIndex} images={images} title={slide.title} onExplanationChange={setImageExplanation} /> : (
            <div aria-hidden="true" className="relative flex min-h-72 items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-900 via-blue-800 to-sky-600 text-white">
              <span className="absolute -right-28 -top-24 h-96 w-96 rounded-full border-[56px] border-white/10" />
              <span className="text-8xl font-light">✦</span>
            </div>
          ))}
          <div className={`${readingView ? 'mx-auto max-w-3xl' : 'flex min-h-0 flex-col p-8 md:p-10'}`}>
            <div className="flex flex-col gap-4 pb-4">
              <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={() => setShowChapterList(true)} disabled={isRevealing}
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-900 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 transition hover:bg-blue-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-blue-700"><FiList aria-hidden="true" /> <span className="hidden sm:inline">Chapters</span></button>
              <button type="button" onClick={() => setReadingView((current) => !current)} aria-pressed={readingView} disabled={isRevealing}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-blue-200 dark:border-blue-900 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 transition hover:bg-blue-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-blue-700">
                {readingView ? <FiMinimize2 aria-hidden="true" /> : <FiMaximize2 aria-hidden="true" />}
                {readingView ? 'Split view' : 'Reading view'}
              </button>
              </div>
              <p className="min-w-0 break-words text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Chapter {slide.chapter}{titleScrolled && !readingView && <span className="ml-2 normal-case tracking-normal text-slate-700 dark:text-slate-200">· {slide.title}</span>}</p>
            </div>
            <div ref={textRef} onScroll={handleTextScroll} tabIndex={readingView ? undefined : 0} aria-label={readingView ? undefined : `${slide.title} text`}
              className={readingView ? '' : 'min-h-0 flex-1 md:overflow-y-auto md:pr-3'}>
              {imageExplanation && !readingView ? <div>
                <p className="whitespace-pre-wrap break-words text-lg leading-8 text-slate-700 dark:text-slate-200">{imageExplanation.text}</p>
              </div> : null}
              <div hidden={!!imageExplanation && !readingView}>
              <h2 ref={titleRef} className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{slide.title}</h2>
              {slide.draft && <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Sample passage · replace with your own telling</p>}
              <ChapterText key={slide.chapterId} text={slide.text} chapterId={slide.chapterId} scrollRef={textRef} readerRef={sectionRef} suspended={!!imageExplanation || isRevealing || showChapterList} onParagraphChange={onParagraphChange} resumeParagraphIndex={initialBookmark.chapterId === slide.chapterId ? initialBookmark.paragraphIndex : null} />
              </div>
            </div>
          </div>
        </article>
      )}
      {isRevealing && <div aria-hidden="true" className="story-reveal-overlay pointer-events-auto absolute inset-0 z-10 rounded-3xl bg-white dark:bg-slate-900" />}
      </div>

    </section>
      {showChapterList ? <div className="mt-5 rounded-2xl border border-white dark:border-slate-700 bg-white/85 dark:bg-slate-900/90 px-5 py-4 text-center text-sm font-medium text-slate-600 dark:text-slate-300 shadow-sm">Select a chapter above, or close the list to keep reading.</div> : <div className="sticky top-[calc(var(--site-header-height,8rem)+0.5rem)] z-20 mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-100 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-4 py-3 shadow-md backdrop-blur-sm sm:px-6">
        <button type="button" onClick={() => goToSlide(slideIndex - 1)} disabled={isFirst || isRevealing}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 transition hover:bg-blue-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-400 dark:disabled:text-slate-400 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-blue-700">
          <FiArrowLeft aria-hidden="true" /> Previous
        </button>
        <div aria-live="polite" className="text-center">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{slide.type === 'note' ? 'Author’s note' : `Chapter ${slide.chapter}${plannedChapters ? ` of ${plannedChapters}` : ''}`}</p>
          {slide.type === 'story' && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{availableChapters} {availableChapters === 1 ? 'chapter available' : 'chapters available'}{moreComing ? ' · More coming' : ''}</p>}
        </div>
        <button type="button" onClick={slide.type === 'note' ? beginStory : isLast && moreComing ? () => setShowMoreComing(true) : () => goToSlide(slideIndex + 1)} disabled={(isLast && !moreComing) || isRevealing || loading}
          className="inline-flex items-center gap-2 rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
          {slide.type === 'note' ? 'Read story' : isLast && moreComing ? 'More coming' : 'Next'} <FiArrowRight aria-hidden="true" />
        </button>
      </div>}
      {showMoreComing && <MoreComingPrompt title={story.title} signedIn={!!user} following={following} onClose={() => setShowMoreComing(false)} />}
    </>
  )
}

export default StorySlides
