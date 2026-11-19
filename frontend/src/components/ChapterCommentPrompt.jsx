import { useEffect, useRef } from 'react'
import { FiMessageCircle, FiX } from 'react-icons/fi'

const ChapterCommentPrompt = ({ chapter, onClose }) => {
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    element.showModal()
    return () => { element.close(); previousFocus?.focus() }
  }, [])
  const joinDiscussion = () => {
    onClose()
    requestAnimationFrame(() => {
      const field = document.getElementById('story-comment')
      field?.focus({ preventScroll: true })
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="chapter-comment-heading" aria-describedby="chapter-comment-description" className="chapter-comment-prompt m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-3xl border border-blue-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-slate-900 dark:text-slate-100 shadow-2xl sm:p-10">
    <button type="button" onClick={onClose} aria-label="Close comment reminder" className="absolute right-4 top-4 rounded-full p-2 text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800"><FiX /></button>
    <span className="inline-flex rounded-2xl bg-blue-100 dark:bg-blue-950 p-4 text-2xl text-blue-700 dark:text-blue-300"><FiMessageCircle aria-hidden="true" /></span>
    <p className="mt-5 text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Before the next chapter</p>
    <h2 id="chapter-comment-heading" className="mt-3 text-2xl font-bold tracking-tight">What do you think so far?</h2>
    <div id="chapter-comment-description" className="mt-4 space-y-3 leading-relaxed text-slate-600 dark:text-slate-300">
      <p>What surprised you? What do you think might happen next? Share a question, prediction, or detail that stood out to you in chapter {chapter}.</p>
      <p>Your feedback is appreciated by the community. Leave a comment or reply before continuing.</p>
    </div>
    <button type="button" onClick={joinDiscussion} className="mt-7 w-full rounded-full bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">Leave a comment</button>
    <button type="button" onClick={onClose} className="mt-4 w-full text-sm font-semibold text-slate-500 dark:text-slate-400 hover:underline">Keep reading this chapter</button>
  </dialog>
}

export default ChapterCommentPrompt
