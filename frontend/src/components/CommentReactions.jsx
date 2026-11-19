import { ReactionChip, ReactionUsersDialog } from './ReactionPeople.jsx'
import { useRef, useState } from 'react'
import EmojiPicker from './EmojiPicker.jsx'
import { useAuth } from '../context/auth.js'
import { authError } from '../lib/api.js'

const CommentReactions = ({ comment, onReact, onProfile, storyId, chapterId, disabled = false, restricted = false }) => {
  const { requireAccount } = useAuth()
  const [saving, setSaving] = useState(false)
  const [viewingEmoji, setViewingEmoji] = useState(null)
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
      {(comment.reactions || []).map(({ emoji, count }) => <ReactionChip key={emoji} emoji={emoji} count={count} selected={comment.myReaction === emoji}
        disabled={disabled || saving || (restricted && comment.myReaction !== emoji)} onReact={() => react(emoji)} onProfile={onProfile} onViewMore={() => setViewingEmoji(emoji)}
        storyId={storyId} chapterId={chapterId} commentId={comment.id} />)}
      <EmojiPicker onSelect={react} onRequestOpen={requestAccount} triggerLabel="React" disabled={disabled || saving || restricted} />
    </div>
    {viewingEmoji && <ReactionUsersDialog key={viewingEmoji} emoji={viewingEmoji} storyId={storyId} chapterId={chapterId} commentId={comment.id} onProfile={onProfile} onClose={() => setViewingEmoji(null)} />}
    {error && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
  </div>
}
export default CommentReactions
