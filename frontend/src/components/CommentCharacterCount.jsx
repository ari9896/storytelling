const CommentCharacterCount = ({ id, value }) => {
  const count = Array.from(value.normalize('NFC').replace(/\p{Cf}/gu, '').replace(/\s+/gu, ' ').trim()).length
  return <p id={id} className="mt-2 text-xs text-slate-500 dark:text-slate-400">{count} characters · Minimum 30 · Maximum 1,000</p>
}
export default CommentCharacterCount
