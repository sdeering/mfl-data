'use client'

import { useEffect, useState, type RefObject } from 'react'

export interface RenderedSurface {
  color: string // The element's background as rendered, e.g. "rgb(31, 41, 55)"
  isDark: boolean
}

/** Resolve any CSS colour (rgb, lab, oklch, ...) to whether it is dark, by letting the browser paint it. */
function isDarkColor(cssColor: string): boolean | null {
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return null

  context.fillStyle = cssColor
  context.fillRect(0, 0, 1, 1)
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 < 0.5
}

/**
 * The background an element is really rendered with. Anything drawn in JS rather than CSS (a chart)
 * can use this to match the page: here dark styling follows both the OS setting and the theme
 * toggle, so the theme context alone doesn't say which one is on screen.
 *
 * Pass `isRendered` when the element only appears later (after data loads), so it is measured then.
 */
export function useRenderedSurface(ref: RefObject<HTMLElement | null>, isRendered = true): RenderedSurface | null {
  const [surface, setSurface] = useState<RenderedSurface | null>(null)

  useEffect(() => {
    const measure = () => {
      if (!ref.current) return
      const color = getComputedStyle(ref.current).backgroundColor
      const isDark = isDarkColor(color)
      if (isDark === null) return
      setSurface(current => (current?.color === color ? current : { color, isDark }))
    }
    measure()

    // The theme toggle changes a class on <html>; the OS setting changes a media query
    const observer = new MutationObserver(measure)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', measure)

    return () => {
      observer.disconnect()
      media.removeEventListener('change', measure)
    }
  }, [ref, isRendered])

  return surface
}
