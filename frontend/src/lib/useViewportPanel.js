import { useLayoutEffect } from 'react'
import { panelPosition } from './panelPosition.js'

export const useViewportPanel = (open, anchorRef, panelRef) => {
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !panelRef.current) return undefined
    const update = () => {
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (!anchor || !panel) return
      const position = panelPosition(anchor.getBoundingClientRect(), panel.getBoundingClientRect(), document.documentElement.clientWidth, window.visualViewport?.height || window.innerHeight)
      panel.style.left = `${position.left}px`
      panel.style.right = 'auto'
      panel.style.maxHeight = `${position.maxHeight}px`
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(anchorRef.current)
    observer.observe(panelRef.current)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [open, anchorRef, panelRef])
}
