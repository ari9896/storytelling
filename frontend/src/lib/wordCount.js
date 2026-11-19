const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null

export const countWords = (text = '') => {
  if (segmenter) {
    let count = 0
    for (const segment of segmenter.segment(text)) if (segment.isWordLike) count++
    return count
  }
  return (text.match(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)*/gu) || []).length
}
