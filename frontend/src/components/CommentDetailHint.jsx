const CommentDetailHint = ({ id, message }) => <div id={id} role="status" className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
  <p className="text-sm font-semibold">Tell us a little more</p>
  <p className="mt-1 text-sm leading-relaxed">{message}</p>
</div>

export default CommentDetailHint
