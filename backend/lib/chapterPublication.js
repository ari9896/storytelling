// Chapters saved before publication controls existed remain published.
export const isPublishedChapter = chapter => !!chapter && chapter.status !== 'draft'
export const publishedChapters = story => story.chapters.filter(isPublishedChapter)
export const hasPublishedChapters = story => story.chapters.some(isPublishedChapter)
export const resolveChapterStatus = (input, existing) => input.status === undefined ? (existing ? existing.status || 'published' : 'draft') : input.status
