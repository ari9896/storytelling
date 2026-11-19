import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/auth.js'
import { api, authError } from '../lib/api.js'
const FeedbackForm = ({ user }) => {
  const [values, setValues] = useState({ username: user.username, email: user.email, subject: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const submit = async event => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setSuccess('')
    try {
      const { data } = await api.post('/feedback', values)
      setSuccess(data.message); setValues(current => ({ ...current, subject: '', message: '' }))
      window.dispatchEvent(new Event('feedback-updated'))
    } catch (failure) { setError(authError(failure)) }
    finally { setBusy(false) }
  }
  const update = event => setValues(current => ({ ...current, [event.target.name]: event.target.value }))
  const field = 'mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
  return <main className="mx-auto max-w-2xl py-12"><h1 className="text-3xl font-bold">Feedback</h1><p className="mt-3 text-slate-600 dark:text-slate-300">Have a suggestion, question, or problem? We’d like to hear from you.</p>
    <form onSubmit={submit} className="mt-7 rounded-3xl bg-white p-7 shadow-lg dark:bg-slate-900"><fieldset disabled={busy} className="space-y-5">
      <label className="block text-sm font-semibold">Username<input name="username" value={values.username} onChange={update} required maxLength={80} className={field} /></label>
      <label className="block text-sm font-semibold">Email<input name="email" type="email" value={values.email} onChange={update} required maxLength={254} className={field} /></label>
      <label className="block text-sm font-semibold">Subject<input name="subject" value={values.subject} onChange={update} required maxLength={200} className={field} /></label>
      <label className="block text-sm font-semibold">Message<textarea name="message" value={values.message} onChange={update} required maxLength={5000} rows={7} className={field} /></label>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}{success && <p role="status" className="text-sm text-green-700 dark:text-green-300">{success}</p>}
      <button className="rounded-full bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{busy ? 'Sending…' : 'Send feedback'}</button>
    </fieldset></form>
  </main>
}
const Feedback = () => {
  const { user, loading } = useAuth()
  if (loading) return <main className="py-16" role="status">Checking your account…</main>
  if (!user) return <Navigate to="/login" state={{ returnTo: '/feedback' }} replace />
  return <FeedbackForm key={user._id} user={user} />
}
export default Feedback
