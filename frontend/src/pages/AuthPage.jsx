import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth.js'
import { authError } from '../lib/api.js'

const AuthPage = ({ mode }) => {
  const isSignup = mode === 'signup'
  const { user, loading, login, signup } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const requestedPath = location.state?.returnTo
  const returnTo = typeof requestedPath === 'string' && requestedPath.startsWith('/') && !requestedPath.startsWith('//') && !/^\/(login|signup)([/?#]|$)/.test(requestedPath) ? requestedPath : '/'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to={returnTo} replace />
  const submit = async event => {
    event.preventDefault()
    if (busy || loading) return
    const values = Object.fromEntries(new FormData(event.currentTarget))
    setError('')
    setBusy(true)
    try {
      if (isSignup) await signup(values)
      else await login(values)
      navigate(returnTo, { replace: true })
    } catch (failure) {
      setError(authError(failure))
    } finally {
      setBusy(false)
    }
  }
  const fieldClass = 'mt-2 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
  return <main className="mx-auto max-w-md py-12 sm:py-16">
    <section className="rounded-3xl border border-white dark:border-slate-700 bg-white dark:bg-slate-900 p-7 shadow-xl shadow-blue-900/10 sm:p-9">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Storytelling</p>
      <h1 className="mt-3 text-3xl font-bold">{isSignup ? 'Start your next chapter' : 'Welcome back'}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{isSignup ? 'Create a free account to read every chapter and join the discussion.' : 'Log in to keep reading and join the conversation.'}</p>
      <form onSubmit={submit} className="mt-7 space-y-5">
        {isSignup ? <>
          <label className="block text-sm font-semibold">Username<input name="username" required minLength={3} maxLength={20} pattern="[a-zA-Z0-9]+" autoComplete="username" className={fieldClass} /><span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">3–20 letters and numbers.</span></label>
          <label className="block text-sm font-semibold">Email<input name="email" type="email" required autoComplete="email" className={fieldClass} /></label>
        </> : <label className="block text-sm font-semibold">Username or email<input name="identifier" required autoComplete="username" className={fieldClass} /></label>}
        <label className="block text-sm font-semibold">Password<input name="password" type="password" required minLength={isSignup ? 8 : undefined} autoComplete={isSignup ? 'new-password' : 'current-password'} className={fieldClass} />{isSignup && <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">At least 8 characters, including a lowercase letter and a number.</span>}</label>
        {error && <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
        <button disabled={busy || loading} className="w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{loading ? 'Checking your session…' : busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">{isSignup ? 'Already have an account?' : 'New to Storytelling?'} <Link to={isSignup ? '/login' : '/signup'} state={{ returnTo }} className="font-semibold text-blue-700 dark:text-blue-300 hover:underline">{isSignup ? 'Log in' : 'Sign up'}</Link></p>
    </section>
  </main>
}

export default AuthPage
