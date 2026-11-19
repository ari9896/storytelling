import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FiUsers } from 'react-icons/fi'
import { api } from '../lib/api.js'
const UsersAdminLink = () => {
  const [count, setCount] = useState(0)
  const { pathname } = useLocation()
  useEffect(() => {
    let active = true
    let sequence = 0
    const refresh = () => {
      if (document.hidden) return
      const request = ++sequence
      api.get('/user/admin/users/unread').then(({ data }) => { if (active && request === sequence) setCount(data.unreadCount) }).catch(() => {})
    }
    const visited = () => { sequence++; setCount(0); refresh() }
    refresh()
    const interval = setInterval(refresh, 30000)
    window.addEventListener('users-page-visited', visited)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; clearInterval(interval); window.removeEventListener('users-page-visited', visited); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  return <Link to="/admin/users" aria-current={pathname === '/admin/users' ? 'page' : undefined} aria-label={`Users${count ? `, ${count} new` : ''}`} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-950"><FiUsers aria-hidden="true" />Users{count > 0 && <span aria-hidden="true" className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white">{count > 99 ? '99+' : count}</span>}</Link>
}
export default UsersAdminLink
