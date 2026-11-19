import { useState } from 'react'
import { api, authError } from '../lib/api.js'
const CommentRestrictionForm = ({ userId, restriction, onSaved }) => {
  const [openedAt] = useState(() => Date.now())
  const [status, setStatus] = useState(restriction?.status || 'none')
  const [reason, setReason] = useState('')
  const [expiry, setExpiry] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const submit = async event => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setSuccess('')
    try {
      const { data } = await api.patch(`/user/admin/users/${userId}/comment-restriction`, { status, reason, expiresAt: status === 'temporary' ? new Date(expiry).toISOString() : null })
      onSaved(data.commentRestriction)
      setSuccess(status === 'none' ? 'Commenting access restored.' : 'Commenting restriction saved.')
    } catch (failure) { setError(authError(failure)) }
    finally { setBusy(false) }
  }
  const field = 'mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
  const expired = restriction?.status === 'temporary' && new Date(restriction.expiresAt).getTime() <= openedAt
  return <section className="mt-7 rounded-2xl border border-blue-200 p-5 dark:border-slate-700"><h3 className="font-bold">Commenting access</h3>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Current: {expired ? 'None (temporary restriction expired)' : restriction?.status || 'none'}</p>
    {restriction?.reason && <p className="mt-2 text-sm">Reason: {restriction.reason}</p>}
    {restriction?.expiresAt && <p className="mt-2 text-sm">Expires: {new Date(restriction.expiresAt).toLocaleString()}</p>}
    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Restrictions apply to comments and replies. Existing posts and unlocked chapters remain available; further chapters still require comments.</p>
    <form onSubmit={submit}><fieldset disabled={busy} className="mt-4 space-y-4">
      <label className="block text-sm font-semibold">Status<select value={status} onChange={event => setStatus(event.target.value)} className={field}><option value="none">None / Restore commenting</option><option value="temporary">Temporary</option><option value="indefinite">Indefinite</option></select></label>
      {status === 'temporary' && <label className="block text-sm font-semibold">Expires at (your local time)<input type="datetime-local" value={expiry} onChange={event => setExpiry(event.target.value)} required className={field} /></label>}
      <label className="block text-sm font-semibold">Reason (visible to this user)<textarea value={reason} onChange={event => setReason(event.target.value)} required maxLength={500} rows={2} className={field} /></label>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}{success && <p role="status" className="text-sm text-green-700 dark:text-green-300">{success}</p>}
      <button className="rounded-full bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{busy ? 'Saving…' : status === 'none' ? 'Restore commenting' : 'Save restriction'}</button>
    </fieldset></form>
  </section>
}
export default CommentRestrictionForm
