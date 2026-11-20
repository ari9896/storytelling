const ratings = {
  unrated: { label: 'Unrated', style: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  everyone: { label: 'Everyone', style: 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200' },
  teen: { label: 'Teen', style: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  mature: { label: 'Mature', style: 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200' },
}
const StoryRating = ({ value }) => {
  const rating = ratings[value] || ratings.unrated
  return <span title={`Content rating: ${rating.label}`} aria-label={`Content rating: ${rating.label}`} className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${rating.style}`}>{rating.label}</span>
}
export default StoryRating
