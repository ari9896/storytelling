import UserDetails from '../components/AdminUserDetails.jsx'
import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { FiUser } from 'react-icons/fi'
import { useAuth } from '../context/auth.js'
import { api, authError } from '../lib/api.js'

const Users = () => {
  const { user, loading } = useAuth()
  const [newUsers, setNewUsers] = useState([])
  const visitRequest = useRef(null)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  useEffect(() => {
    if (loading || user?.role !== 'admin') return undefined
    let active = true
    api.get(`/user/admin/users?page=${page}`).then(({ data }) => { if (active) { setResult(data); setError('') } }).catch(failure => { if (active) setError(authError(failure)) })
    return () => { active = false }
  }, [page, user?._id, user?.role, loading])
  useEffect(() => {
    if (loading || user?.role !== 'admin') return undefined
    let active = true
    if (visitRequest.current?.userId !== user._id) visitRequest.current = { userId: user._id, promise: api.post('/user/admin/users/visit') }
    visitRequest.current.promise.then(({ data }) => {
      if (!active) return
      setNewUsers(data.newUserIds)
      window.dispatchEvent(new Event('users-page-visited'))
    }).catch(failure => { if (active) setError(authError(failure)) })
    return () => { active = false }
  }, [user?._id, user?.role, loading])
  const cardsLoaded = !!result
  useEffect(() => {
    if (!cardsLoaded || !newUsers.length) return undefined
    const timer = setTimeout(() => setNewUsers([]), 3500)
    return () => clearTimeout(timer)
  }, [cardsLoaded, newUsers.length])
  if (loading) return <main className="py-16" role="status">Checking your account…</main>
  if (!user) return <Navigate to="/login" state={{ returnTo: '/admin/users' }} replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  const ready = result?.page === page
  return <main className="mx-auto max-w-6xl py-10">
    <p className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Administration</p><h1 className="mt-2 text-3xl font-bold">Users</h1>
    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{result ? `${result.total} registered users. ` : ''}Select a user to view their profile history and story participation.</p>
    {error && <p role="alert" className="mt-5 text-red-700 dark:text-red-300">{error}</p>}
    {!ready && !error && <p role="status" className="mt-5">Loading users…</p>}
    {ready && <><div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{result.users.map(person => <button key={person._id} type="button" onClick={() => setSelected(person._id)} className={`${newUsers.includes(person._id) ? 'new-user-card ' : ''}flex min-w-0 flex-col items-center rounded-3xl border border-blue-100 bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900`}>
      {person.profilePic ? <img src={person.profilePic} alt="" className="h-24 w-24 rounded-full object-cover" /> : <span className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-4xl text-blue-700 dark:bg-blue-950 dark:text-blue-300"><FiUser aria-hidden="true" /></span>}
      <span className="mt-4 w-full truncate font-bold">{person.username}</span><span className="mt-2 w-full break-all text-sm text-slate-500 dark:text-slate-400">{person.email}</span>
    </button>)}</div>{!result.users.length && <p className="mt-7">No users found.</p>}</>}
    <div className="mt-7 flex items-center justify-between gap-3"><button disabled={page === 1} onClick={() => setPage(current => current - 1)} className="rounded-full border border-blue-200 px-5 py-2 text-sm disabled:opacity-40 dark:border-slate-700">Previous</button><p className="text-sm">Page {page}{result ? ` of ${result.pages}` : ''}</p><button disabled={!ready || page >= result.pages} onClick={() => setPage(current => current + 1)} className="rounded-full border border-blue-200 px-5 py-2 text-sm disabled:opacity-40 dark:border-slate-700">Next</button></div>
    {selected && <UserDetails key={selected} id={selected} onClose={() => setSelected(null)} />}
  </main>
}
export default Users
