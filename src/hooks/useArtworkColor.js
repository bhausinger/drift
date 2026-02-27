import { useState, useEffect } from 'react'

export function useArtworkColor(artworkUrl) {
  const [color, setColor] = useState(null)

  useEffect(() => {
    if (!artworkUrl) { setColor(null); return }

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 4
        canvas.height = 4
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, 4, 4)
        const { data } = ctx.getImageData(0, 0, 4, 4)
        let r = 0, g = 0, b = 0
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
        }
        const pixels = data.length / 4
        setColor(`rgb(${Math.round(r / pixels)}, ${Math.round(g / pixels)}, ${Math.round(b / pixels)})`)
      } catch {
        // CORS or canvas failure — graceful degradation
        setColor(null)
      }
    }

    img.onerror = () => setColor(null)
    img.src = artworkUrl

    return () => { img.onload = null; img.onerror = null }
  }, [artworkUrl])

  return color
}
