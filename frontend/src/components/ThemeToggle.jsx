import { useState } from 'react'
import { FiMoon, FiSun } from 'react-icons/fi'

const ThemeToggle = () => {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    document.documentElement.style.colorScheme = next ? 'dark' : 'light'
    try { localStorage.setItem('storytelling-theme', next ? 'dark' : 'light') } catch { /* Theme still works when storage is unavailable. */ }
    setDark(next)
  }
  return <button type="button" onClick={toggle} aria-label={dark ? 'Switch to day mode' : 'Switch to night mode'} title={dark ? 'Day mode' : 'Night mode'} aria-pressed={dark} className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-200 bg-white text-xl text-blue-700 shadow-sm hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-slate-800">
    {dark ? <FiSun aria-hidden="true" /> : <FiMoon aria-hidden="true" />}
  </button>
}
export default ThemeToggle
