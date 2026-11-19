import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiMessageSquare } from 'react-icons/fi'
import { api } from '../lib/api.js'
const FeedbackAdminLink = () => {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let active = true
    const refresh = () => { if (!document.hidden) api.get('/feedback/unread').then(({ data }) => { if (active) setCount(data.unreadCount) }).catch(() => {}) }
    refresh()
    const interval = setInterval(refresh, 30000)
    window.addEventListener('feedback-updated', refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; clearInterval(interval); window.removeEventListener('feedback-updated', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  return <Link to="/admin/feedback" aria-label={`Feedback${count ? `, ${count} unread` : ''}`} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-950"><FiMessageSquare aria-hidden="true" />Feedback{count > 0 && <span aria-hidden="true" className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white">{count > 99 ? '99+' : count}</span>}</Link>
}
export default FeedbackAdminLink
