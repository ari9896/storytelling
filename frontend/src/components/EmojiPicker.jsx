import { useEffect, useId, useRef, useState } from 'react'
import { FiSmile, FiX } from 'react-icons/fi'

const choices = [
  ['😀','grinning happy smile'],['😃','smile happy'],['😄','laugh happy'],['😁','grin'],['😆','laugh'],['😅','nervous relieved'],['😂','tears joy laughing'],['🤣','rolling laughing'],['🙂','smile'],['😊','blush happy'],['🥰','love hearts'],['😍','heart eyes love'],['🤩','star eyes amazed'],['😘','kiss'],['😎','cool sunglasses'],['🤔','thinking question'],['🧐','curious monocle'],['🤨','skeptical'],['😐','neutral'],['🙄','eye roll'],['😮','surprised wow'],['😲','astonished'],['😳','embarrassed'],['🥺','pleading touched'],['😢','sad crying'],['😭','crying sobbing'],['😔','sad thoughtful'],['😟','worried'],['😨','afraid scared'],['😱','scream shocked'],['😤','frustrated'],['😠','angry'],['🤯','mind blown'],['🤗','hug'],['🤭','giggle'],['🫢','gasp'],['🫡','salute respect'],['😴','sleep'],['😌','relieved peaceful'],['😇','angel'],
  ['👍','thumbs up agree'],['👎','thumbs down disagree'],['👏','clap applause'],['🙌','celebrate praise'],['🙏','thanks prayer'],['🤝','handshake agreement'],['💪','strength strong'],['👀','eyes watching'],['💭','thought thinking'],['💬','speech discussion'],['❓','question'],['❗','exclamation'],['💡','idea'],['❤️','red heart love'],['🧡','orange heart'],['💛','yellow heart'],['💚','green heart'],['💙','blue heart'],['💜','purple heart'],['🖤','black heart'],['🤍','white heart'],['🤎','brown heart'],['💔','broken heart'],['💕','two hearts'],['✨','sparkles'],['⭐','star'],['🌟','glowing star'],['🔥','fire'],['🎉','celebration party'],['📖','book reading story'],['📚','books'],['✍️','writing'],['🌳','tree forest'],['🌿','leaf nature'],['🌸','flower'],['🌅','sunrise'],['🌙','moon night'],['☀️','sun'],['🌧️','rain'],['🦋','butterfly'],['🐦','bird'],['🕊️','dove peace'],['🌎','earth world'],['🏹','bow arrow'],['🛡️','shield'],
]

const EmojiPicker = ({ textareaId, value, onChange, disabled = false }) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const root = useRef(null)
  const trigger = useRef(null)
  const id = useId()
  useEffect(() => {
    if (!open) return undefined
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false) }
    const escape = event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  const insert = emoji => {
    const textarea = document.getElementById(textareaId)
    if (!textarea || disabled) return
    const start = textarea.selectionStart ?? value.length
    const end = textarea.selectionEnd ?? start
    const next = value.slice(0, start) + emoji + value.slice(end)
    if (next.length > (textarea.maxLength > 0 ? textarea.maxLength : Infinity)) return
    onChange(next)
    setOpen(false)
    requestAnimationFrame(() => { textarea.focus({ preventScroll: true }); textarea.setSelectionRange(start + emoji.length, start + emoji.length) })
  }
  const filtered = choices.filter(([emoji, label]) => label.includes(query.trim().toLowerCase()) || emoji === query.trim())
  return <div ref={root} className="relative mt-2">
    <button ref={trigger} type="button" disabled={disabled} onClick={() => { setOpen(current => !current); setQuery('') }} aria-label="Add emoji" title="Add emoji" aria-expanded={open} aria-controls={id} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40 dark:text-blue-300 dark:hover:bg-blue-950"><FiSmile aria-hidden="true" />Emoji</button>
    {open && !disabled && <div id={id} role="dialog" aria-label="Choose an emoji" className="absolute bottom-full left-0 z-30 mb-2 w-[min(20rem,calc(100vw-5rem))] rounded-2xl border border-blue-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-slate-900 dark:text-slate-100">Choose an emoji</p><button type="button" onClick={() => { setOpen(false); trigger.current?.focus() }} aria-label="Close emoji picker" className="rounded-full p-2 text-slate-500 hover:bg-blue-50 dark:text-slate-400 dark:hover:bg-slate-800"><FiX /></button></div>
      <input autoFocus type="search" aria-label="Search emojis" placeholder="Search: happy, heart, thinking…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
      <div className="mt-3 grid max-h-52 grid-cols-6 gap-1 overflow-y-auto">{filtered.map(([emoji, label]) => <button key={emoji} type="button" aria-label={label} title={label} onClick={() => insert(emoji)} className="rounded-lg p-2 text-2xl hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-700">{emoji}</button>)}</div>
      {!filtered.length && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No matches. Try another word.</p>}
    </div>}
  </div>
}
export default EmojiPicker
