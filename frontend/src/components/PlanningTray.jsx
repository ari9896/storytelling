import { useId, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FiCalendar, FiGitBranch, FiPlus, FiUser } from 'react-icons/fi'
import { PLANNING_TABS } from '../lib/editorPlanning.js'

const labels = { characters: { plural: 'Characters', single: 'character', Icon: FiUser }, events: { plural: 'Events', single: 'event', Icon: FiCalendar }, threads: { plural: 'Threads', single: 'thread', Icon: FiGitBranch } }
const PlanningTray = ({ mode, onModeChange, items, selectedIndex, onSelect, onAdd, disabled, trayRef }) => {
  const id = useId()
  const tabs = useRef([])
  const switcherRef = useRef(null)
  useLayoutEffect(() => {
    const panel = trayRef.current, switcher = switcherRef.current
    if (!panel || !switcher) return undefined
    const align = () => {
      if (window.matchMedia('(min-width: 1280px)').matches) {
        const bounds = panel.getBoundingClientRect()
        switcher.style.left = `${bounds.left}px`
        switcher.style.width = `${bounds.width}px`
      } else {
        switcher.style.removeProperty('left')
        switcher.style.removeProperty('width')
      }
    }
    align()
    const observer = new ResizeObserver(align)
    observer.observe(panel)
    window.addEventListener('resize', align)
    window.addEventListener('scroll', align, true)
    return () => { observer.disconnect(); window.removeEventListener('resize', align); window.removeEventListener('scroll', align, true) }
  }, [trayRef])
  const { plural, single, Icon } = labels[mode]
  const changeTab = (event, index) => {
    const key = event.key
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return
    event.preventDefault()
    const next = key === 'Home' ? 0 : key === 'End' ? 2 : (index + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1) + 3) % 3
    onModeChange(PLANNING_TABS[next]); tabs.current[next]?.focus()
  }
  return <><aside ref={trayRef} aria-label="Private story planning" className="relative z-10 mb-5 rounded-2xl border border-blue-200 bg-white/95 p-2 shadow-md backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 xl:sticky xl:top-[calc(var(--site-header-height,8rem)+1rem)] xl:w-full">
    <p className="mb-2 px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{plural} · Private</p>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${mode}`} className="flex flex-wrap gap-2 xl:flex-col xl:flex-nowrap">
      {items.map((item, index) => { const title = (mode === 'characters' ? item.name : item.title).trim() || `Untitled ${single}`
        return <button key={item.id} type="button" disabled={disabled} aria-pressed={selectedIndex === index} onClick={() => onSelect(index)} title={selectedIndex === index ? 'Return to chapter editor' : title}
          className={`flex min-w-20 shrink-0 flex-col items-center gap-1 rounded-xl border p-2 text-xs focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 ${selectedIndex === index ? 'border-blue-500 bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100' : 'border-transparent text-slate-700 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
          {mode === 'characters' && item.images[0] ? <img src={item.images[0].url} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <Icon aria-hidden="true" className="h-9 w-9 p-1" />}
          <span className="w-16 truncate font-semibold">{title}</span>
        </button>
      })}
      <button type="button" disabled={disabled || items.length >= 100} onClick={onAdd} aria-label={`Add ${single}`} className="flex min-h-16 min-w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-blue-300 p-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-slate-800"><FiPlus aria-hidden="true" className="text-xl" />Add {single}</button>
    </div>
  </aside>
    {createPortal(<div ref={switcherRef} role="tablist" aria-label="Planning category" aria-orientation="vertical" className="fixed bottom-24 left-5 z-20 flex w-28 flex-col gap-1 rounded-2xl border border-blue-200 bg-white/95 p-2 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 sm:bottom-8 sm:left-8">
      {PLANNING_TABS.map((tab, index) => <button key={tab} ref={element => { tabs.current[index] = element }} id={`${id}-${tab}`} type="button" role="tab" disabled={disabled} aria-selected={mode === tab} aria-controls={`${id}-panel`} tabIndex={mode === tab ? 0 : -1} onClick={() => onModeChange(tab)} onKeyDown={event => changeTab(event, index)} className={`rounded-lg px-2 py-2 text-left text-xs font-semibold focus-visible:outline-2 focus-visible:outline-blue-600 ${mode === tab ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100' : 'text-slate-600 hover:bg-blue-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{labels[tab].plural}</button>)}
    </div>, document.body)}
  </>
}
export default PlanningTray
