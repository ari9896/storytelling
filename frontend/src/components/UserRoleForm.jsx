import { useRef, useState } from 'react'
import { api, authError } from '../lib/api.js'

const UserRoleForm = ({ userId, currentRole, onSaved }) => {
  const [role, setRole] = useState(currentRole === 'writer' ? 'writer' : 'reader')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const pending = useRef(false)
  if (currentRole === 'admin') return null
  const save = async event => {
    event.preventDefault()
    if (pending.current || role === currentRole) return
    pending.current = true
    setSaving(true); setError(''); setSuccess('')
    try {
      const { data } = await api.patch(`/user/admin/users/${userId}/role`, { role })
      onSaved(data.user)
      setSuccess(`Role updated to ${data.user.role}.`)
    } catch (failure) { setError(authError(failure)) }
    finally { pending.current = false; setSaving(false) }
  }
  return <form onSubmit={save} className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-slate-800">
    <label htmlFor={`user-role-${userId}`} className="block font-semibold">Story upload access</label>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Writers can upload stories and manage their own. Readers cannot upload new stories.</p>
    <div className="mt-3 flex flex-wrap items-center gap-3"><select id={`user-role-${userId}`} value={role} disabled={saving} onChange={event => { setRole(event.target.value); setError(''); setSuccess('') }} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"><option value="reader">Reader</option><option value="writer">Writer</option></select>
      <button type="submit" disabled={saving || role === currentRole} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? 'Saving…' : 'Save role'}</button></div>
    {success && <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-300">{success}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
  </form>
}
export default UserRoleForm
