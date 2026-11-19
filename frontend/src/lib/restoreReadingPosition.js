export const restoreReadingPosition = (paragraph, container, reader) => {
  const overflow = getComputedStyle(container).overflowY
  if (overflow === 'auto' || overflow === 'scroll') {
    // Move only the text pane to the bookmark, then align the whole reader.
    const offset = paragraph.getBoundingClientRect().top - container.getBoundingClientRect().top - container.clientTop
    container.scrollTo({ top: container.scrollTop + offset, behavior: 'instant' })
    reader?.scrollIntoView({ behavior: 'instant', block: 'start' })
  } else {
    // On mobile and in reading view, the page itself is the text scroller.
    paragraph.scrollIntoView({ behavior: 'instant', block: 'start' })
  }
}
