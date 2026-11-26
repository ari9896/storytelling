export const moveChapter = (chapters, sourceId, targetId) => {
  const from = chapters.findIndex(chapter => chapter.id === sourceId)
  const to = chapters.findIndex(chapter => chapter.id === targetId)
  if (from < 0 || to < 0 || from === to) return chapters
  const reordered = [...chapters]
  const [chapter] = reordered.splice(from, 1)
  reordered.splice(to, 0, chapter)
  return reordered
}

export const hasDraftBeforePublished = chapters => {
  let draftFound = false
  for (const chapter of chapters) {
    if (chapter.status === 'draft') draftFound = true
    else if (draftFound) return true
  }
  return false
}
