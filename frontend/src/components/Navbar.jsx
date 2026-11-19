import FeedbackAdminLink from './FeedbackAdminLink.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import NotificationMenu from './NotificationMenu.jsx'
import { useEffect, useRef } from 'react'
import { useAuth } from '../context/auth.js'
import { FiArrowUpRight, FiBookOpen, FiFeather, FiHome, FiUsers } from 'react-icons/fi'
import { Link, useLocation } from 'react-router-dom'
import ProfileMenu from './ProfileMenu.jsx'

const Navbar = () => {
  const headerRef = useRef(null)
  useEffect(() => {
    const header = headerRef.current
    const updateHeight = () => document.documentElement.style.setProperty('--site-header-height', `${header.getBoundingClientRect().height}px`)
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(header)
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--site-header-height') }
  }, [])
  const { user, loading } = useAuth()
  const { pathname, hash } = useLocation()
  const homeActive = pathname === '/' && !hash
  const storiesActive = pathname.startsWith('/stories/') || hash === '#stories'

  return (
    <header ref={headerRef} className="sticky top-0 z-30 border-b border-white/60 dark:border-slate-800 bg-sky-50/80 dark:bg-slate-950/90 shadow-sm shadow-blue-900/5 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 py-3 sm:px-8">
        <Link to="/" aria-label="Storytelling home" className="group flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-xl text-white shadow-md shadow-blue-700/20 transition group-hover:-rotate-6">
            <FiFeather aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Storytelling</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Stories worth sharing</span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="order-3 flex w-full items-center gap-2 border-t border-blue-100 dark:border-slate-700 pt-3 lg:order-2 lg:w-auto lg:border-0 lg:pt-0">
          <Link to="/" aria-current={homeActive ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-blue-600 ${homeActive ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200' : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 hover:text-blue-800 dark:hover:text-blue-200'}`}>
            <FiHome aria-hidden="true" /> Home
          </Link>
          <Link to="/#stories" aria-current={storiesActive ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-blue-600 ${storiesActive ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200' : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 hover:text-blue-800 dark:hover:text-blue-200'}`}>
            <FiBookOpen aria-hidden="true" /> Stories
          </Link>
          {user?.role === 'admin' && <Link to="/admin/users" aria-current={pathname === '/admin/users' ? 'page' : undefined} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-950"><FiUsers aria-hidden="true" /> Users</Link>}
          {user?.role === 'admin' && <FeedbackAdminLink key={user._id} />}
        </nav>

        <Link to={/^\/stories\/[^/]+$/.test(pathname) ? `${pathname}#discussion` : "/#stories"} className="order-2 ml-auto flex items-center gap-2 rounded-full bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:order-3 lg:ml-0">
          <span className="hidden sm:inline">Join discussion</span><span className="sm:hidden">Discuss</span> <FiArrowUpRight aria-hidden="true" />
        </Link>
        {!user && !loading && <div className="order-2 flex items-center gap-3 text-sm font-semibold lg:order-3"><Link to="/login" className="text-blue-700 dark:text-blue-300 hover:underline">Log in</Link><Link to="/signup" className="rounded-full border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 px-4 py-2 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800">Sign up</Link></div>}
        <div className="order-2 flex items-center gap-3 lg:order-3">
          <ThemeToggle />
          {user && <NotificationMenu key={user._id} />}
          <ProfileMenu />
        </div>
      </div>
    </header>
  )
}

export default Navbar
