export const panelPosition = (anchor, panel, viewportWidth, viewportHeight, margin = 16) => {
  const width = Math.min(panel.width, Math.max(0, viewportWidth - margin * 2))
  const viewportLeft = Math.max(margin, Math.min(anchor.right - width, viewportWidth - width - margin))
  return { left: viewportLeft - anchor.left, maxHeight: Math.max(80, viewportHeight - panel.top - margin) }
}
