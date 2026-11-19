import Footer from '../components/Footer.jsx'
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'

const SiteLayout = () => {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }))
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [pathname, hash])

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-sky-100 dark:from-slate-950 via-blue-100 dark:via-slate-900 to-blue-200 dark:to-slate-950 text-slate-900 dark:text-slate-100">
      <Navbar />
      <div className="flex-1 px-5 sm:px-8">
        <Outlet />
      </div>
      <Footer />
    </div>
  )
}

export default SiteLayout
