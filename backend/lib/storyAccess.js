export const canReadChapter = (story, index, user) => {
  if (index === 0) return true
  if (!user) return false
  if (story.creatorId && String(story.creatorId) === String(user._id)) return true
  if (user.role === 'admin') return true
  return story.chapters.slice(0, index).every(chapter =>
    chapter.commentedUserIds?.some(id => String(id) === String(user._id)))
}
