import { useEffect, useId, useRef, useState } from 'react'
import { FiTrash2 } from 'react-icons/fi'

const DeleteActionMenu = ({ label, actionLabel, onDelete, disabled = false, actionDisabled = false, disabledReason = '' }) => {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  const action = useRef(null)
  const id = useId()
  useEffect(() => {
    if (!open) return undefined
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false) }
    const escape = event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus({ preventScroll: true }) } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  const toggle = () => {
    if (disabled) return
    setOpen(current => !current)
    if (!open) requestAnimationFrame(() => action.current?.focus({ preventScroll: true }))
  }
  return <div ref={root} className="relative shrink-0" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <button ref={trigger} type="button" disabled={disabled} onClick={toggle} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); requestAnimationFrame(() => action.current?.focus({ preventScroll: true })) } }}
      aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      className="flex h-8 w-8 items-center justify-center rounded-full text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-950">
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 4h8L6 9z" fill="currentColor" /></svg>
    </button>
    {open && <div id={id} role="menu" aria-label={label} className="absolute right-0 top-full z-30 mt-2 w-52 rounded-xl border border-red-100 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <button ref={action} type="button" role="menuitem" disabled={disabled || actionDisabled} onClick={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); onDelete() }}
        onKeyDown={event => { if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) { event.preventDefault(); action.current?.focus() } }}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-950"><FiTrash2 aria-hidden="true" />{actionLabel}</button>
      {actionDisabled && disabledReason && <p className="px-3 pb-2 text-xs text-slate-500 dark:text-slate-400">{disabledReason}</p>}
    </div>}
  </div>
}
export default DeleteActionMenu
