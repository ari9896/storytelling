export const hasUserComment = (comments, userId) => !!userId && comments.some(comment =>
  comment.authorId === userId || hasUserComment(comment.replies || [], userId))

export const firstMissingComment = (slides, targetIndex, user, commentsByChapter, requireAdminComment = false, progressByChapter = {}, creatorId = null) => {
  if (user && creatorId && String(creatorId) === String(user._id)) return null
  if (!user || (user.role === 'admin' && !requireAdminComment)) return null
  return slides.slice(0, targetIndex).find(slide => slide.type === 'story' &&
    !(progressByChapter[slide.chapter] || hasUserComment(commentsByChapter[slide.chapter] || [], user._id))) || null
}
