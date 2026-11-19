import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const SignupPrompt = ({ reason, returnTo, onClose }) => {
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    element.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = overflow
      previousFocus?.focus()
    }
  }, [])
  return <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }} aria-labelledby="signup-prompt-title" aria-describedby="signup-prompt-description" className="signup-prompt m-auto w-[calc(100%_-_2rem)] max-w-md rounded-3xl border border-blue-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-slate-900 dark:text-slate-100 shadow-2xl">
    <button type="button" onClick={onClose} aria-label="Close signup prompt" className="absolute right-4 top-3 rounded-full p-2 text-xl text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800">×</button>
    <p className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Your next chapter</p>
    <h2 id="signup-prompt-title" className="mt-3 text-2xl font-bold">Join the story</h2>
    <p id="signup-prompt-description" className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">{reason} Create a free account to keep reading and join the conversation.</p>
    <Link autoFocus to="/signup" state={{ returnTo }} onClick={onClose} className="mt-6 block rounded-xl bg-blue-700 px-5 py-3 text-center font-semibold text-white hover:bg-blue-800">Sign up</Link>
    <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">Already have an account? <Link to="/login" state={{ returnTo }} onClick={onClose} className="font-semibold text-blue-700 dark:text-blue-300 hover:underline">Log in</Link></p>
    <button type="button" onClick={onClose} className="mt-5 w-full text-sm font-medium text-slate-500 dark:text-slate-400 hover:underline">Keep browsing</button>
  </dialog>
}

export default SignupPrompt
