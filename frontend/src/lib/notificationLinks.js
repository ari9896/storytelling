export const notificationLink = item => {
  const story = `/stories/${encodeURIComponent(item.slug)}`
  if (item.type === 'story_invite') return story
  return `${story}?chapter=${encodeURIComponent(item.chapterId)}${item.type === 'new_chapter' ? '' : `#comment-${encodeURIComponent(item.commentId)}`}`
}
