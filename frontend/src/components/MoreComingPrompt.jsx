import { useEffect, useRef } from 'react'
import { FiBookOpen, FiX } from 'react-icons/fi'

const MoreComingPrompt = ({ title, signedIn, following, onClose }) => {
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  const discuss = () => {
    onClose()
    requestAnimationFrame(() => {
      const field = document.getElementById('story-comment')
      field?.focus({ preventScroll: true })
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="more-coming-title" aria-describedby="more-coming-description" className="more-coming-prompt m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-3xl border border-blue-100 bg-white p-8 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
    <button type="button" onClick={onClose} aria-label="Close new chapter information" className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-blue-50 dark:text-slate-400 dark:hover:bg-slate-800"><FiX /></button>
    <FiBookOpen aria-hidden="true" className="text-3xl text-blue-700 dark:text-blue-300" />
    <h2 id="more-coming-title" className="mt-5 text-2xl font-bold">You’re caught up!</h2>
    <div id="more-coming-description" className="mt-4 space-y-3 leading-relaxed text-slate-600 dark:text-slate-300">
      <p>Thank you for your interest in {title}. You’ve reached the latest available chapter, and there’s more to come.</p>
      <p>{following ? 'You’ll receive a notification in your bell when a new chapter is added, because you’ve commented on this story.' : signedIn ? 'Leave a comment or reply on this story to receive new-chapter notifications in your bell.' : 'Sign in and leave a comment or reply on this story to receive new-chapter notifications in your bell.'}</p>
    </div>
    {!following && <button type="button" onClick={discuss} className="mt-6 w-full rounded-full bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">Join the discussion</button>}
    <button type="button" onClick={onClose} className="mt-5 w-full rounded-full border border-blue-200 px-5 py-3 font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-slate-800">Back to the story</button>
  </dialog>
}
export default MoreComingPrompt
