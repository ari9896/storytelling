import DeleteActionMenu from '../components/DeleteActionMenu.jsx'
import PlanningTray from '../components/PlanningTray.jsx'
import { loadPlanningSheets, newPlanningSheet, PLANNING_TABS, restorePlanningSelection, serializePlanningSheets } from '../lib/editorPlanning.js'
import { loadCharacterSheets, newCharacterSheet, serializeCharacterSheets } from '../lib/editorCharacters.js'
import ChapterOrderList from '../components/ChapterOrderList.jsx'
import { hasDraftBeforePublished, moveChapter } from '../lib/chapterOrder.js'
import { useImageCrop } from '../lib/useImageCrop.jsx'
import { countWords } from '../lib/wordCount.js'
import ImageBackdrop from '../components/ImageBackdrop.jsx'
import { api, authError } from '../lib/api.js'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { FiArrowLeft, FiChevronLeft, FiChevronRight, FiImage, FiPlus, FiTrash2, FiChevronDown, FiSave } from 'react-icons/fi'
import { useAuth } from '../context/auth.js'

const newChapter = () => ({ id: crypto.randomUUID(), status: 'draft', title: '', text: '', images: [] })

const StoryUpload = ({ mode = 'create' }) => {
  const { storyId } = useParams()
  const location = useLocation()
  const { prepareImage, cropDialog } = useImageCrop()
  const editing = mode === 'edit'
  const [loadedId, setLoadedId] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [version, setVersion] = useState(null)
  const { user, loading } = useAuth()
  const accountId = user?._id
  const navigate = useNavigate()
  const [thumbnail, setThumbnail] = useState(null)
  const [thumbnailView, setThumbnailView] = useState(false)
  const thumbnailInput = useRef(null)
  const [plannedChapterCount, setPlannedChapterCount] = useState('')
  const [title, setTitle] = useState('')
  const [contentRating, setContentRating] = useState('unrated')
  const [authorNote, setAuthorNote] = useState(null)
  const [noteMenu, setNoteMenu] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedToast, setSavedToast] = useState(0)
  const [syncFailed, setSyncFailed] = useState(false)
  useEffect(() => {
    if (!savedToast) return undefined
    const timeout = setTimeout(() => setSavedToast(0), 4000)
    return () => clearTimeout(timeout)
  }, [savedToast])
  const [chapters, setChapters] = useState(() => [newChapter()])
  const [characters, setCharacters] = useState([])
  const [events, setEvents] = useState([])
  const [threads, setThreads] = useState([])
  const [planningSelection, setPlanningSelection] = useState(null)
  const [sidebarMode, setSidebarMode] = useState(() => PLANNING_TABS.includes(location.state?.sidebarMode) ? location.state.sidebarMode : 'characters')
  const [characterIndex, setCharacterIndex] = useState(null)
  const [characterImageIndex, setCharacterImageIndex] = useState(0)
  const [chapterIndex, setChapterIndex] = useState(0)
  const [imageIndex, setImageIndex] = useState(0)
  const [error, setError] = useState('')
  const editorRef = useRef(null)
  const characterTrayRef = useRef(null)
  const pendingEditorScroll = useRef(false)
  useLayoutEffect(() => {
    const editor = editorRef.current
    if (!pendingEditorScroll.current || !editor) return
    pendingEditorScroll.current = false
    const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--site-header-height')) || 0
    const trayHeight = characterTrayRef.current && !window.matchMedia('(min-width: 1280px)').matches && getComputedStyle(characterTrayRef.current).position === 'sticky' ? characterTrayRef.current.getBoundingClientRect().height + 8 : 0
    const top = window.scrollY + editor.getBoundingClientRect().top - headerHeight - trayHeight - 16
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? 'instant' : 'smooth' })
  }, [characterIndex, characters.length, planningSelection?.type, planningSelection?.index, events.length, threads.length, thumbnailView, loading, loadedId])
  const saveNoteRef = useRef(null)
  const saveActionRef = useRef(null)
  useEffect(() => {
    const note = saveNoteRef.current
    const action = saveActionRef.current
    if (!note || !action) return undefined
    const align = () => {
      const noteHeight = note.getBoundingClientRect().height
      const buttonHeight = action.getBoundingClientRect().height
      if (window.innerWidth < 640) {
        action.style.marginTop = '20px'
        action.style.marginBottom = '0px'
        return
      }
      action.style.marginTop = `${-(noteHeight + buttonHeight) / 2}px`
      action.style.marginBottom = `${(noteHeight - buttonHeight) / 2}px`
    }
    align()
    const observer = new ResizeObserver(align)
    observer.observe(note)
    observer.observe(action)
    window.addEventListener('resize', align)
    return () => { observer.disconnect(); window.removeEventListener('resize', align) }
  }, [loading, loadedId, editing])
  const inputRef = useRef(null)
  const urls = useRef(new Set())
  useEffect(() => {
    const previews = urls.current
    return () => previews.forEach(url => URL.revokeObjectURL(url))
  }, [])
  useEffect(() => {
    if (!editing || !accountId || loading) return undefined
    let active = true
    api.get(`/stories/${encodeURIComponent(storyId)}/edit`).then(({ data }) => {
      if (!active) return
      setTitle(data.title)
      setContentRating(data.contentRating || 'unrated')
      setPlannedChapterCount(data.plannedChapterCount == null ? '' : String(data.plannedChapterCount))
      setThumbnail(data.thumbnail)
      setAuthorNote(data.authorNote)
      setVersion(data.version)
      setChapters(data.chapters.map(chapter => ({ ...chapter, status: chapter.status || 'published', chapterId: chapter.id, images: chapter.images.map((image, index) => ({ ...image, id: `${chapter.id}-${index}` })) })))
      setCharacters(loadCharacterSheets(data.characters))
      const loadedEvents = loadPlanningSheets(data.events), loadedThreads = loadPlanningSheets(data.threads)
      setEvents(loadedEvents); setThreads(loadedThreads)
      const restoredPlanning = restorePlanningSelection({ type: location.state?.planningSelection?.type, index: location.state?.planningSelection?.index }, loadedEvents, loadedThreads)
      setPlanningSelection(restoredPlanning)
      const restoredCharacter = location.state?.characterIndex
      setCharacterIndex(!restoredPlanning && Number.isInteger(restoredCharacter) && restoredCharacter >= 0 && restoredCharacter < (data.characters?.length || 0) ? restoredCharacter : null)
      setChapterIndex(0)
      setImageIndex(0)
      setLoadedId(storyId)
      setLoadError('')
    }).catch(failure => { if (active) setLoadError(authError(failure)) })
    return () => { active = false }
  }, [editing, storyId, accountId, loading, location.state?.characterIndex, location.state?.planningSelection?.type, location.state?.planningSelection?.index])
  if (loading) return <main className="mx-auto max-w-5xl py-16" role="status">Checking your account…</main>
  if (!user) return <Navigate to="/login" state={{ returnTo: editing ? `/stories/${storyId}/edit` : '/stories/new' }} replace />
  if (!editing && !['writer', 'admin'].includes(user.role)) return <Navigate to="/" replace />

  if (editing && loadError) return <main className="mx-auto max-w-5xl py-16"><p role="alert">{loadError}</p><Link to={`/stories/${storyId}`} className="mt-4 inline-block text-blue-700 dark:text-blue-300 underline">Back to story</Link></main>
  if (editing && loadedId !== storyId) return <main className="mx-auto max-w-5xl py-16" role="status">Loading story editor…</main>

  const chapter = chapters[chapterIndex]
  const character = characterIndex === null ? null : characters[characterIndex]
  const planningItems = planningSelection?.type === 'events' ? events : threads
  const planningSheet = planningSelection ? planningItems[planningSelection.index] : null
  const isPlanning = !!character || !!planningSheet
  const sheetType = character ? 'Character' : planningSelection?.type === 'events' ? 'Event' : 'Thread'
  const activeSheetIndex = character ? characterIndex : planningSelection?.index
  const activeSheetItems = character ? characters : planningItems
  const currentItem = character || planningSheet || chapter
  const currentImageIndex = character ? characterImageIndex : imageIndex
  const setCurrentImageIndex = character ? setCharacterImageIndex : setImageIndex
  const image = currentItem.images?.[currentImageIndex]
  const itemLabel = character ? character.name.trim() || 'Character' : planningSheet ? planningSheet.title.trim() || sheetType : `Chapter ${chapterIndex + 1}`
  const currentText = character ? character.notes : planningSheet ? planningSheet.text : chapter.text
  const chapterWordCount = countWords(currentText)
  const publishedCount = chapters.filter(item => item.status !== 'draft').length
  const updateChapter = (values) => setChapters(current => current.map((item, index) => index === chapterIndex ? { ...item, ...values } : item))
  const updateCharacter = values => setCharacters(current => current.map((item, index) => index === characterIndex ? { ...item, ...values } : item))
  const updatePlanningSheet = values => {
    const setter = planningSelection.type === 'events' ? setEvents : setThreads
    setter(current => current.map((item, index) => index === planningSelection.index ? { ...item, ...values } : item))
  }
  const updateCurrent = character ? updateCharacter : planningSheet ? updatePlanningSheet : updateChapter
  const returnToChapter = () => { pendingEditorScroll.current = true; setPlanningSelection(null); setCharacterIndex(null); setThumbnailView(false); setError('') }
  const selectPlanningSheet = (type, index) => {
    pendingEditorScroll.current = true; setCharacterIndex(null); setThumbnailView(false); setError('')
    setPlanningSelection(current => current?.type === type && current.index === index ? null : { type, index })
  }
  const addPlanningSheet = type => {
    pendingEditorScroll.current = true
    const list = type === 'events' ? events : threads, setter = type === 'events' ? setEvents : setThreads
    setter(current => [...current, newPlanningSheet()]); setPlanningSelection({ type, index: list.length })
    setCharacterIndex(null); setThumbnailView(false); setError('')
  }
  const deletePlanningSheet = () => {
    if (!window.confirm(`Remove this ${sheetType.toLowerCase()}? It will be archived when you save.`)) return
    const setter = planningSelection.type === 'events' ? setEvents : setThreads
    setter(current => current.filter((_item, index) => index !== planningSelection.index))
    setPlanningSelection(planningItems.length > 1 ? { type: planningSelection.type, index: Math.min(planningSelection.index, planningItems.length - 2) } : null)
    setError('')
  }
  const selectActiveSheet = index => character ? selectCharacter(index) : selectPlanningSheet(planningSelection.type, index)
  const selectCharacter = index => { pendingEditorScroll.current = true; setPlanningSelection(null); setCharacterIndex(current => current === index ? null : index); setCharacterImageIndex(0); setThumbnailView(false); setError('') }
  const addCharacter = () => { pendingEditorScroll.current = true; setPlanningSelection(null); setCharacters(current => [...current, newCharacterSheet()]); setCharacterIndex(characters.length); setCharacterImageIndex(0); setThumbnailView(false); setError('') }
  const deleteCharacter = () => {
    if (!window.confirm('Remove this character sheet? It will be archived when you save.')) return
    for (const picture of character.images) if (picture.file) { URL.revokeObjectURL(picture.url); urls.current.delete(picture.url) }
    setCharacters(current => current.filter((_item, index) => index !== characterIndex))
    setCharacterIndex(characters.length > 1 ? Math.min(characterIndex, characters.length - 2) : null)
    setCharacterImageIndex(0); setError('')
  }
  const reorderChapter = (sourceId, targetId) => {
    if (saving || syncFailed) return
    const selectedId = chapter.id
    const reordered = moveChapter(chapters, sourceId, targetId)
    if (reordered === chapters) return
    setChapters(reordered)
    setChapterIndex(reordered.findIndex(item => item.id === selectedId))
    setError(hasDraftBeforePublished(reordered) ? 'This order puts a draft before a published chapter. Publish it or move drafts after published chapters before saving.' : '')
  }
  const changeChapterStatus = status => {
    if (status === 'published' && chapters.slice(0, chapterIndex).some(item => item.status === 'draft')) { setError('Publish earlier chapters first so readers can follow the story in order.'); return }
    if (status === 'draft' && chapters.slice(chapterIndex + 1).some(item => item.status !== 'draft')) { setError('Set later chapters to Draft first before making this chapter private.'); return }
    updateChapter({ status })
    setError('')
  }
  const selectChapter = (index) => { setThumbnailView(false); setChapterIndex(index); setImageIndex(0); setError('') }
  const deleteChapter = () => {
    if (chapters.length <= 1) { setError('Keep at least one chapter in the story.'); return }
    if (!window.confirm(`Are you sure you want to delete Chapter ${chapterIndex + 1}? This takes effect when you save changes.`)) return
    for (const picture of chapter.images) if (picture.file) { URL.revokeObjectURL(picture.url); urls.current.delete(picture.url) }
    setChapters(current => current.filter((_item, index) => index !== chapterIndex))
    selectChapter(Math.max(0, chapterIndex - 1))
  }
  const addImages = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    if (currentItem.images.length + files.length > 5) { setError('Each chapter or character can have up to five pictures.'); return }
    if (files.some(file => !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type))) { setError('Choose PNG, JPEG, WebP, or GIF pictures.'); return }
    if (files.some(file => file.size > 5 * 1024 * 1024)) { setError('Each picture must be 5 MB or smaller.'); return }
    const images = []
    for (const [index, original] of files.entries()) {
      const file = await prepareImage(original, { title: `Adjust ${character ? 'character' : 'chapter'} picture ${index + 1} of ${files.length}` })
      if (!file) break
      const url = URL.createObjectURL(file)
      urls.current.add(url)
      images.push({ id: crypto.randomUUID(), file, url })
    }
    if (!images.length) return
    updateCurrent({ images: [...currentItem.images, ...images] })
    setCurrentImageIndex(currentItem.images.length)
    setError('')
  }
  const chooseThumbnail = async event => {
    const original = event.target.files?.[0]
    event.target.value = ''
    if (!original) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(original.type) || original.size > 5 * 1024 * 1024) { setError('Choose a PNG, JPEG, WebP, or GIF thumbnail up to 5 MB.'); return }
    const file = await prepareImage(original, { title: 'Adjust story thumbnail', aspect: String(16 / 9) })
    if (!file) return
    if (thumbnail?.file) { URL.revokeObjectURL(thumbnail.url); urls.current.delete(thumbnail.url) }
    const url = URL.createObjectURL(file)
    urls.current.add(url)
    setThumbnail({ file, url })
    setError('')
  }
  const removeThumbnail = () => {
    if (thumbnail?.file) { URL.revokeObjectURL(thumbnail.url); urls.current.delete(thumbnail.url) }
    setThumbnail(null)
  }
  const removeImage = () => {
    URL.revokeObjectURL(image.url)
    urls.current.delete(image.url)
    updateCurrent({ images: currentItem.images.filter(item => item.id !== image.id) })
    setCurrentImageIndex(index => Math.max(0, index - 1))
    setError('')
  }

  const saveStory = async () => {
    if (saving || syncFailed) return
    if (plannedChapterCount !== '' && (!Number.isInteger(Number(plannedChapterCount)) || Number(plannedChapterCount) < chapters.length || Number(plannedChapterCount) > 10000)) { setError('Planned chapters must be a whole number at least as large as your available chapters (up to 10,000).'); return }
    if (!title.trim()) { setError('Enter a story title before saving.'); return }
    if (hasDraftBeforePublished(chapters)) { setError('Published chapters must come before drafts. Adjust the order or chapter visibility before saving.'); return }
    if (chapters.some(item => item.status !== 'draft' && (!item.title.trim() || !item.text.trim()))) { setError('Published chapters need a title and text. Leave unfinished chapters as Draft.'); return }
    if (authorNote && (!authorNote.title.trim() || !authorNote.text.trim())) { setError('Complete the author note or remove it before saving.'); return }
    if ([...chapters, ...characters].flatMap(item => item.images).reduce((size, item) => size + (item.file?.size || 0), 0) + (thumbnail?.file?.size || 0) > 25 * 1024 * 1024) { setError('Story pictures must total 25 MB or less per save.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = { events: serializePlanningSheets(events), threads: serializePlanningSheets(threads), characters: await serializeCharacterSheets(characters, file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Unable to read a character picture.')); reader.readAsDataURL(file) })), contentRating, plannedChapterCount: plannedChapterCount === '' ? null : Number(plannedChapterCount), title, authorNote, version, chapters: [], thumbnail: null }
      if (thumbnail?.file) {
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = () => reject(new Error('Unable to read thumbnail.'))
          reader.readAsDataURL(thumbnail.file)
        })
        payload.thumbnail = { data, alt: title }
      } else if (thumbnail) payload.thumbnail = { publicId: thumbnail.publicId }
      for (const item of chapters) {
        const images = []
        for (const picture of item.images) {
          if (!picture.file) { images.push({ publicId: picture.publicId, explanation: picture.explanation || '' }); continue }
          const data = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => reject(new Error('Unable to read a picture.'))
            reader.readAsDataURL(picture.file)
          })
          images.push({ data, alt: '', explanation: picture.explanation || '' })
        }
        payload.chapters.push({ id: item.chapterId, status: item.status, title: item.title, text: item.text, images })
      }
      const { data } = editing
        ? await api.put(`/stories/${encodeURIComponent(storyId)}`, payload, { timeout: 180000 })
        : await api.post('/stories', payload, { timeout: 180000 })
      if (editing) {
        setSavedToast(Date.now())
        // Reload canonical IDs and upload URLs so subsequent saves do not duplicate images
        // or conflict with the version that was just committed.
        try {
          const { data: saved } = await api.get(`/stories/${encodeURIComponent(storyId)}/edit`)
          setVersion(saved.version)
          setCharacters(loadCharacterSheets(saved.characters))
          setEvents(loadPlanningSheets(saved.events)); setThreads(loadPlanningSheets(saved.threads))
          setContentRating(saved.contentRating || 'unrated')
          setThumbnail(saved.thumbnail)
          setChapters(saved.chapters.map(chapter => ({ ...chapter, status: chapter.status || 'published', chapterId: chapter.id, images: chapter.images.map((image, index) => ({ ...image, id: `${chapter.id}-${index}` })) })))
        } catch {
          setSyncFailed(true)
          setError('Changes were saved, but the editor could not refresh. Reload this page before making more changes.')
        }
      } else if (characters.length || events.length || threads.length) navigate(`/stories/${data.id}/edit`, { state: { characterIndex, planningSelection, sidebarMode } })
      else navigate(data.availableChapterCount > 0 ? `/stories/${data.id}` : `/stories/${data.id}/edit`)
    } catch (failure) {
      setError(authError(failure))
    } finally {
      setSaving(false)
    }
  }

  return <main className="mx-auto w-full max-w-5xl py-10">
    <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"><FiArrowLeft aria-hidden="true" /> Back to stories</Link>
    <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Story studio</p>
    <h1 className="mt-2 text-3xl font-bold tracking-tight">{editing ? 'Edit story' : 'Story Upload'}</h1>
    <fieldset disabled={saving || syncFailed} className="min-w-0">
    <div className="xl:-ml-[7.5rem] xl:grid xl:grid-cols-[6.5rem_minmax(0,1fr)] xl:items-start xl:gap-4">
    <PlanningTray trayRef={characterTrayRef} mode={sidebarMode} onModeChange={setSidebarMode}
      items={sidebarMode === 'characters' ? characters : sidebarMode === 'events' ? events : threads}
      selectedIndex={sidebarMode === 'characters' ? characterIndex : planningSelection?.type === sidebarMode ? planningSelection.index : null}
      onSelect={index => sidebarMode === 'characters' ? selectCharacter(index) : selectPlanningSheet(sidebarMode, index)}
      onAdd={() => sidebarMode === 'characters' ? addCharacter() : addPlanningSheet(sidebarMode)} disabled={saving || syncFailed} />
    <div className="min-w-0">
    <label htmlFor="upload-story-title" className="mt-7 block text-sm font-semibold text-slate-600 dark:text-slate-300">Story title</label>
    <input id="upload-story-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="Give your story a title" className="mb-6 mt-2 w-full rounded-xl border border-blue-200 dark:border-blue-900 bg-white/70 dark:bg-slate-900/70 px-4 py-3 text-2xl font-bold outline-none placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />

    <div className="mb-7 max-w-xl">
      <label htmlFor="story-content-rating" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Content rating</label>
      <select id="story-content-rating" value={contentRating} onChange={event => setContentRating(event.target.value)} aria-describedby="story-rating-help" className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500 dark:border-blue-900 dark:bg-slate-900 dark:text-slate-100">
        <option value="unrated">Unrated</option><option value="everyone">Everyone</option><option value="teen">Teen</option><option value="mature">Mature</option>
      </select>
      <p id="story-rating-help" className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{{
        unrated: 'Choose a rating based on the strongest content in the entire story. It will appear in the library and on the reading page.',
        everyone: 'For a broad audience, without graphic violence or explicit sexual content.',
        teen: 'Stronger themes, non-graphic violence, or some strong language.',
        mature: 'Graphic violence, explicit sexual content, or other adult themes.',
      }[contentRating]}</p>
    </div>
    <div className="mb-7 max-w-md">
      <label htmlFor="planned-chapters" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Planned number of chapters (optional)</label>
      <input id="planned-chapters" type="number" min={chapters.length} max={10000} step={1} value={plannedChapterCount} onChange={event => setPlannedChapterCount(event.target.value)} placeholder="For example, 30 or 100" aria-describedby="planned-chapters-help" className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500 dark:border-blue-900 dark:bg-slate-900 dark:text-slate-100" />
      <p id="planned-chapters-help" className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{publishedCount} published chapters · {chapters.length - publishedCount} drafts. Set the intended total to show “Chapter 1 of 30” while letting readers know more chapters are coming. Leave blank if the total is undecided.</p>
    </div>
    {authorNote && !isPlanning && <section aria-labelledby="author-note-heading" className="mb-6 rounded-3xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 p-8 shadow-lg shadow-blue-900/5">
      <div className="flex items-center justify-between gap-4"><h2 id="author-note-heading" className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Author’s note · Before chapter 1</h2><button type="button" onClick={() => setAuthorNote(null)} aria-label="Remove author note" className="rounded-full p-2 text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800"><FiTrash2 /></button></div>
      <label className="mt-5 block text-sm font-semibold">Note title<input value={authorNote.title} maxLength={200} onChange={event => setAuthorNote(current => ({ ...current, title: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-xl font-bold focus:outline-blue-500" /></label>
      <label className="mt-5 block text-sm font-semibold">Author’s note<textarea value={authorNote.text} maxLength={100000} onChange={event => setAuthorNote(current => ({ ...current, text: event.target.value }))} rows={5} placeholder="Introduce your story to the reader…" className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-base font-normal leading-8 focus:outline-blue-500" /></label>
    </section>}

    {thumbnailView && !isPlanning ? <section aria-label="Story thumbnail editor" className="overflow-hidden rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-lg shadow-blue-900/10 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Story thumbnail</p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">This image appears in the home menu, separately from your chapter pictures.</p>
      <input ref={thumbnailInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={chooseThumbnail} aria-label="Choose story thumbnail" className="sr-only" />
      <button type="button" onClick={() => thumbnailInput.current?.click()} aria-label={thumbnail ? 'Replace story thumbnail' : 'Add story thumbnail'} className="relative isolate mt-6 flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-slate-800 hover:border-blue-600 focus-visible:outline-2 focus-visible:outline-blue-700">
        {thumbnail ? <><ImageBackdrop src={thumbnail.url} /><img src={thumbnail.url} alt="Story thumbnail preview" className="relative h-full w-full object-contain" /></> : <span className="flex flex-col items-center gap-4 text-blue-700 dark:text-blue-300"><FiImage aria-hidden="true" className="text-5xl" /><span className="text-lg font-semibold">Click to add a thumbnail</span></span>}
      </button>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><p className="text-xs text-slate-500 dark:text-slate-400">One image · PNG, JPEG, WebP, or GIF · Up to 5 MB</p>{thumbnail && <button type="button" onClick={removeThumbnail} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950"><FiTrash2 /> Remove thumbnail</button>}</div>
    </section> : <>
    <section ref={editorRef} aria-label={isPlanning ? `${itemLabel} ${sheetType.toLowerCase()} sheet` : `Chapter ${chapterIndex + 1} editor`} className={`grid overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-lg shadow-blue-900/10 md:min-h-[36rem] ${planningSheet ? '' : 'md:grid-cols-2'}`}>
      {!planningSheet && <div className="flex min-w-0 flex-col bg-gradient-to-br from-indigo-950 via-blue-900 to-sky-800 p-5 text-white sm:p-7">
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={addImages} className="sr-only" aria-label={character ? 'Add character pictures' : 'Add chapter pictures'} />
        {image ? <div className="relative isolate flex min-h-72 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-slate-950/30 md:min-h-80">
          <ImageBackdrop src={image.url} />
          <img src={image.url} alt={`${itemLabel}, picture ${currentImageIndex + 1}`} className="relative max-h-[28rem] w-full object-contain" />
          {currentItem.images.length > 1 && <>
            <button type="button" onClick={() => setCurrentImageIndex(index => (index - 1 + currentItem.images.length) % currentItem.images.length)} aria-label="Previous picture" className="absolute left-3 rounded-full bg-white dark:bg-slate-900 p-3 text-blue-900 dark:text-blue-100 shadow-lg hover:bg-blue-50 dark:hover:bg-slate-800"><FiChevronLeft /></button>
            <button type="button" onClick={() => setCurrentImageIndex(index => (index + 1) % currentItem.images.length)} aria-label="Next picture" className="absolute right-3 rounded-full bg-white dark:bg-slate-900 p-3 text-blue-900 dark:text-blue-100 shadow-lg hover:bg-blue-50 dark:hover:bg-slate-800"><FiChevronRight /></button>
          </>}
        </div> : <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-80 flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-white/40 px-6 py-12 transition hover:border-white dark:hover:border-slate-700 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <FiImage aria-hidden="true" className="text-5xl text-blue-200" />
          <span className="text-lg font-semibold">{character ? 'Add character pictures' : 'Add chapter pictures'}</span>
          <span className="max-w-56 text-center text-sm leading-relaxed text-blue-100">Click to choose up to five images for this {character ? 'character' : 'chapter'}.</span>
        </button>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-blue-100">{currentItem.images.length ? `Picture ${currentImageIndex + 1} of ${currentItem.images.length}` : '0 of 5 pictures'}</p>
          <div className="flex items-center gap-2">
            {image && <button type="button" onClick={removeImage} aria-label="Remove current picture" className="rounded-full p-2 hover:bg-white/15"><FiTrash2 /></button>}
            {image && <button type="button" disabled={currentItem.images.length >= 5} onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-blue-900 dark:text-blue-100 hover:bg-blue-50 dark:hover:bg-slate-800 disabled:opacity-50"><FiPlus aria-hidden="true" /> Add pictures</button>}
          </div>
        </div>
        {image && <label className="mt-5 block text-sm font-semibold text-white">Explanation for picture {currentImageIndex + 1} (optional)
          <textarea value={image.explanation || ''} maxLength={2000} rows={3} onChange={event => updateCurrent({ images: currentItem.images.map(picture => picture.id === image.id ? { ...picture, explanation: event.target.value } : picture) })} placeholder="Why did you choose this picture?" className="mt-2 w-full rounded-xl border border-white/30 bg-slate-950/40 p-3 text-sm font-normal leading-relaxed text-white placeholder:text-blue-200 focus:outline-2 focus:outline-white" />
          <span className="mt-1 block text-xs font-normal text-blue-200">Each picture has its own explanation, separate from the chapter text.</span>
        </label>}
        <p className="mt-3 text-xs text-blue-200">PNG, JPEG, WebP, or GIF · Up to 5 MB each</p>
        {savedToast > 0 && <div role="status" className="fixed right-5 top-[calc(var(--site-header-height,8rem)+1rem)] z-50 flex items-center gap-5 rounded-2xl border border-green-300 bg-green-100 px-5 py-4 font-semibold text-green-900 shadow-xl dark:border-green-700 dark:bg-green-950 dark:text-green-100 sm:right-8">
      Changes saved
      <button type="button" aria-label="Dismiss saved notification" onClick={() => setSavedToast(0)} className="rounded-full px-2 py-1 hover:bg-green-200 dark:hover:bg-green-900">×</button>
    </div>}
    {error && <p role="alert" className="mt-3 rounded-xl bg-white dark:bg-slate-900 p-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
      </div>}
      <div className="flex min-w-0 flex-col p-8 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">{isPlanning ? `${sheetType} · ${character ? 'Public' : 'Private'}` : `Chapter ${chapterIndex + 1}`}</p>
          <DeleteActionMenu key={character?.id || planningSheet?.id || chapter.id} label={isPlanning ? `${sheetType} options` : 'Chapter options'} actionLabel={isPlanning ? `Delete ${sheetType.toLowerCase()}` : 'Delete chapter'} onDelete={character ? deleteCharacter : planningSheet ? deletePlanningSheet : deleteChapter} disabled={saving || syncFailed} actionDisabled={!isPlanning && chapters.length <= 1} disabledReason="Keep at least one chapter in the story." />
        </div>
        {!isPlanning && <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-slate-800">
          <label htmlFor="chapter-publication-status" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Chapter visibility</label>
          <select id="chapter-publication-status" value={chapter.status || 'published'} onChange={event => changeChapterStatus(event.target.value)} aria-describedby="chapter-publication-help" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900">
            <option value="draft">Draft — private</option><option value="published">Published — visible to readers</option>
          </select>
          <p id="chapter-publication-help" className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{chapter.status === 'draft' ? 'Only you can open this chapter in the editor. Save rough notes or leave fields blank. Choose Published and save when it is ready.' : 'This chapter is available to readers after you save. Choose Draft to make it private.'}</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Visibility changes take effect when you save. Publish chapters in order.</p>
        </div>}
        <label htmlFor="upload-chapter-title" className="mt-8 text-sm font-semibold text-slate-600 dark:text-slate-300">{character ? 'Character name' : planningSheet ? `${sheetType} title` : 'Chapter title'}</label>
        <input id="upload-chapter-title" value={character ? character.name : planningSheet ? planningSheet.title : chapter.title} maxLength={200} onChange={event => updateCurrent(character ? { name: event.target.value } : { title: event.target.value })} placeholder={character ? 'Character name' : planningSheet ? `${sheetType} title` : 'Name this chapter'} className="mt-2 w-full border-b border-slate-200 dark:border-slate-700 py-3 text-2xl font-bold outline-none placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:border-blue-500" />
        <div className="mt-7 flex items-center justify-between gap-3">
          <label htmlFor="upload-chapter-text" className="text-sm font-semibold text-slate-600 dark:text-slate-300">{character ? 'Character introduction' : planningSheet ? `${sheetType} text` : 'Chapter text'}</label>
          <span id="chapter-word-count" className="text-sm tabular-nums text-slate-500 dark:text-slate-400">{chapterWordCount.toLocaleString()} {chapterWordCount === 1 ? 'word' : 'words'}</span>
        </div>
        <textarea id="upload-chapter-text" aria-describedby="chapter-word-count" value={currentText} maxLength={100000} onChange={event => updateCurrent(character ? { notes: event.target.value } : { text: event.target.value })} placeholder={character ? 'Introduce this character to readers. This text and the pictures are public when the story has published chapters…' : planningSheet ? 'Write your ideas here…' : 'Your story starts here…'} rows={10} className="mt-3 min-h-64 w-full flex-1 resize-y rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-lg leading-8 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
      </div>
    </section>
    </>}
    {isPlanning ? <nav aria-label={`${sheetType} navigation`} className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/85 p-4 dark:bg-slate-900/90">
      <button type="button" disabled={activeSheetIndex === 0} onClick={() => selectActiveSheet(activeSheetIndex - 1)} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-40 dark:text-blue-300"><FiChevronLeft />Previous {sheetType.toLowerCase()}</button>
      <button type="button" onClick={returnToChapter} className="text-center text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">{sheetType} {activeSheetIndex + 1} of {activeSheetItems.length}<span className="block text-xs font-normal">Return to chapter</span></button>
      <button type="button" disabled={activeSheetIndex === activeSheetItems.length - 1} onClick={() => selectActiveSheet(activeSheetIndex + 1)} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-40 dark:text-blue-300">Next {sheetType.toLowerCase()}<FiChevronRight /></button>
    </nav> : <nav aria-label="Editor navigation" className="mt-5 flex items-center justify-between rounded-2xl bg-white/85 dark:bg-slate-900/90 p-4">
      {!thumbnailView ? <button type="button" onClick={() => chapterIndex === 0 ? setThumbnailView(true) : selectChapter(chapterIndex - 1)} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800"><FiChevronLeft />{chapterIndex === 0 ? 'Thumbnail' : 'Previous'}</button> : <span className="px-4 text-sm font-semibold text-blue-700 dark:text-blue-300">Thumbnail</span>}
      <button type="button" disabled={!thumbnailView && chapterIndex === chapters.length - 1} onClick={() => thumbnailView ? selectChapter(0) : selectChapter(chapterIndex + 1)} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-400">{thumbnailView ? 'Chapter 1' : 'Next'}<FiChevronRight /></button>
    </nav>}
    {!isPlanning && <nav aria-label="Draft chapters" className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-white/85 dark:bg-slate-900/90 p-4 shadow-sm">
      <button type="button" onClick={() => setThumbnailView(true)} aria-current={thumbnailView ? 'step' : undefined} className="inline-flex items-center gap-3 rounded-2xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800">{thumbnail ? <img src={thumbnail.url} alt="" className="h-10 w-16 rounded-md object-cover" /> : <FiImage aria-hidden="true" />}Thumbnail</button>
      <ChapterOrderList chapters={chapters} selectedId={thumbnailView ? null : chapter.id} onSelect={selectChapter} onReorder={reorderChapter} disabled={saving || syncFailed} />
      <div className="group relative ml-auto flex items-center gap-1 pb-2 -mb-2">
        <button type="button" disabled={chapters.length >= 50} onClick={() => { setChapters(current => [...current, newChapter()]); selectChapter(chapters.length) }} className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800 disabled:opacity-50"><FiPlus aria-hidden="true" /> Add chapter</button>
        <button type="button" aria-label="More chapter options" aria-expanded={noteMenu} onClick={() => setNoteMenu(current => !current)} className="rounded-full p-2 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800"><FiChevronDown /></button>
        {!authorNote && <div className={`absolute right-0 top-full z-20 w-52 pt-2 transition-opacity delay-300 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${noteMenu ? 'visible opacity-100' : 'invisible opacity-0'}`}><button type="button" onClick={() => { setAuthorNote({ title: 'A note from the author', text: '' }); setNoteMenu(false); requestAnimationFrame(() => document.getElementById('author-note-heading')?.scrollIntoView({ behavior: 'smooth', block: 'center' })) }} className="w-full rounded-xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-blue-700 dark:text-blue-300 shadow-lg hover:bg-blue-50 dark:hover:bg-slate-800">Add author’s note</button></div>}
      </div>
    </nav>}
    <p ref={saveNoteRef} className="mt-8 flex min-h-12 w-full max-w-lg sm:w-[calc(100%_-_24rem)] items-center text-sm text-slate-500 dark:text-slate-400">{editing ? 'Save updates public characters and published chapters. Events, threads, and draft chapters stay private.' : 'Save stores your work. Characters appear with published stories. Events, threads, and draft chapters stay private.'} Unsaved changes are lost if you leave or refresh.</p>
    <div ref={saveActionRef} className="pointer-events-none sticky bottom-6 z-20 -mt-12 flex min-h-12 flex-wrap justify-end gap-3 sm:bottom-8">
      {editing && <button type="button" disabled={saving} onClick={() => navigate(publishedCount > 0 ? `/stories/${storyId}` : '/')} className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-lg hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800 disabled:opacity-60"><FiArrowLeft aria-hidden="true" />Exit edit view</button>}
      <button type="button" onClick={saveStory} className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-blue-700 px-6 py-3 font-bold text-white shadow-lg hover:bg-blue-800 disabled:opacity-60"><FiSave aria-hidden="true" />{saving ? 'Saving story…' : editing ? 'Save changes' : 'Save story'}</button>
    </div>
    </div>
    </div>
    </fieldset>
    {savedToast > 0 && <div role="status" className="fixed right-5 top-[calc(var(--site-header-height,8rem)+1rem)] z-50 flex items-center gap-5 rounded-2xl border border-green-300 bg-green-100 px-5 py-4 font-semibold text-green-900 shadow-xl dark:border-green-700 dark:bg-green-950 dark:text-green-100 sm:right-8">
      Changes saved
      <button type="button" aria-label="Dismiss saved notification" onClick={() => setSavedToast(0)} className="rounded-full px-2 py-1 hover:bg-green-200 dark:hover:bg-green-900">×</button>
    </div>}
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-4 text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
    {saving && <p role="status" className="mt-4 text-sm text-blue-700 dark:text-blue-300">Uploading pictures and saving your story. Please keep this page open.</p>}
    {cropDialog}
  </main>
}

export default StoryUpload
