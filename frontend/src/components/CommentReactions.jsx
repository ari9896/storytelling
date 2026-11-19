import { useRef, useState } from 'react'
import EmojiPicker from './EmojiPicker.jsx'
import { useAuth } from '../context/auth.js'
import { authError } from '../lib/api.js'

const CommentReactions = ({ comment, onReact, disabled = false, restricted = false }) => {
  const { requireAccount } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const requestAccount = () => requireAccount('Sign up to react to comments.')
  const react = async emoji => {
    if (pending.current || disabled || !requestAccount()) return
    const next = comment.myReaction === emoji ? null : emoji
    if (restricted && next !== null) return
    pending.current = true
    setSaving(true)
    setError('')
    try { await onReact(next) } catch (failure) { setError(authError(failure)) }
    finally { pending.current = false; setSaving(false) }
  }
  return <div className="mt-3">
    <div className="flex flex-wrap items-center gap-2" aria-label="Comment reactions" aria-busy={saving}>
      {(comment.reactions || []).map(({ emoji, count }) => <button key={emoji} type="button" aria-pressed={comment.myReaction === emoji}
        aria-label={`${emoji}: ${count} ${count === 1 ? 'reaction' : 'reactions'}${comment.myReaction === emoji ? ', including yours. Click to remove' : '. Click to react'}`}
        disabled={disabled || saving || (restricted && comment.myReaction !== emoji)} onClick={() => react(emoji)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm disabled:opacity-50 ${comment.myReaction === emoji ? 'border-blue-500 bg-blue-100 text-blue-900 dark:border-blue-400 dark:bg-blue-900 dark:text-blue-100' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'}`}>
        <span className="text-lg" aria-hidden="true">{emoji}</span><span>{count}</span>
      </button>)}
      <EmojiPicker onSelect={react} onRequestOpen={requestAccount} triggerLabel="React" disabled={disabled || saving || restricted} />
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
  </div>
}
export default CommentReactions
