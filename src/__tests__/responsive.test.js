import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Read the CSS to verify responsive design rules
const cssPath = path.resolve(__dirname, '../index.css')
const css = fs.readFileSync(cssPath, 'utf-8')

describe('responsive CSS', () => {
  it('has prefers-reduced-motion support', () => {
    expect(css).toContain('prefers-reduced-motion')
  })

  it('disables animations for reduced motion', () => {
    // The CSS should pause or remove animations when reduced motion is preferred
    expect(css).toMatch(/prefers-reduced-motion.*reduce/s)
  })

  it('supports safe-area-inset for notched devices', () => {
    expect(css).toContain('safe-area-inset')
  })

  it('defines drift animations', () => {
    expect(css).toContain('@keyframes drift-1')
    expect(css).toContain('@keyframes drift-2')
    expect(css).toContain('@keyframes drift-3')
  })

  it('defines breathe animation', () => {
    expect(css).toContain('@keyframes breathe')
  })

  it('defines fade-in animation', () => {
    expect(css).toContain('@keyframes fade-in')
  })

  it('defines artwork-enter animation', () => {
    expect(css).toContain('@keyframes artwork-enter')
  })
})

// Read key component files to verify responsive patterns
const componentsDir = path.resolve(__dirname, '../components')

describe('component responsiveness', () => {
  it('BottomTabs uses safe-area padding', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'BottomTabs.jsx'), 'utf-8')
    expect(content).toContain('safe-area')
  })

  it('Player has keyboard shortcuts', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'Player.jsx'), 'utf-8')
    // Space for play/pause, arrows for skip
    expect(content).toMatch(/keydown|KeyboardEvent|Space|ArrowRight/i)
  })

  it('VolumeControl is hidden on mobile', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'VolumeControl.jsx'), 'utf-8')
    expect(content).toMatch(/hidden|sm:|md:/i)
  })

  it('TrackInfo has image error handling with CDN fallback', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'TrackInfo.jsx'), 'utf-8')
    expect(content).toContain('getImageFallback')
  })

  it('ProgressBar has touch-friendly hit area', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'ProgressBar.jsx'), 'utf-8')
    // Should have pointer events or touch handling
    expect(content).toMatch(/pointer|touch|onPointerDown|onTouchStart/i)
  })
})

// Verify the HTML has proper viewport and PWA meta tags
const htmlPath = path.resolve(__dirname, '../../index.html')
const html = fs.readFileSync(htmlPath, 'utf-8')

describe('index.html meta tags', () => {
  it('has viewport meta tag', () => {
    expect(html).toContain('viewport')
    expect(html).toContain('width=device-width')
  })

  it('has theme-color meta tag', () => {
    expect(html).toContain('theme-color')
  })

  it('has apple-touch-icon', () => {
    expect(html).toContain('apple-touch-icon')
  })

  it('has Open Graph meta tags', () => {
    expect(html).toContain('og:title')
    expect(html).toContain('og:description')
    expect(html).toContain('og:image')
  })

  it('has PWA manifest comment (injected at build time)', () => {
    expect(html).toContain('vite-plugin-pwa')
  })
})
