import { FiPlus, FiUser } from 'react-icons/fi'

const CharacterTray = ({ characters, selectedIndex, onSelect, onAdd, disabled, trayRef }) => <aside ref={trayRef} aria-label="Private character sheets"
  className="sticky top-[calc(var(--site-header-height,8rem)+0.5rem)] z-10 mb-5 rounded-2xl border border-blue-200 bg-white/95 p-2 shadow-md backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 xl:fixed xl:left-[max(0.5rem,calc(50%_-_41rem))] xl:top-[calc(var(--site-header-height,8rem)+1rem)] xl:w-28">
  <p className="mb-2 px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Characters · Private</p>
  <div className="flex flex-wrap gap-2 xl:flex-col xl:flex-nowrap">
    {characters.map((character, index) => <button key={character.id} type="button" disabled={disabled} aria-pressed={selectedIndex === index} onClick={() => onSelect(index)}
      title={selectedIndex === index ? 'Return to chapter editor' : character.name.trim() || 'Unnamed character'}
      className={`flex min-w-20 shrink-0 flex-col items-center gap-1 rounded-xl border p-2 text-xs focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 ${selectedIndex === index ? 'border-blue-500 bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100' : 'border-transparent text-slate-700 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
      {character.images[0] ? <img src={character.images[0].url} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <FiUser aria-hidden="true" className="h-9 w-9 p-1" />}
      <span className="w-16 truncate font-semibold">{character.name.trim() || 'Unnamed'}</span>
    </button>)}
    <button type="button" disabled={disabled || characters.length >= 100} onClick={onAdd} aria-label="Add character sheet" className="flex min-h-16 min-w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-blue-300 p-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-slate-800"><FiPlus aria-hidden="true" className="text-xl" />Add character</button>
  </div>
</aside>
export default CharacterTray
