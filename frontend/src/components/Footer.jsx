import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth.js'
import SignupPrompt from './SignupPrompt.jsx'
const Footer = () => {
  const { user, loading } = useAuth()
  const [prompt, setPrompt] = useState(false)
  return <footer className="mt-auto border-t border-blue-200 px-5 py-7 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
    {user ? <Link to="/feedback" className="font-semibold text-blue-700 hover:underline dark:text-blue-300">Feedback</Link> : <button type="button" disabled={loading} onClick={() => setPrompt(true)} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">Feedback</button>}
    {prompt && !user && <SignupPrompt reason="Sign up or log in to share feedback." returnTo="/feedback" onClose={() => setPrompt(false)} />}
  </footer>
}
export default Footer
