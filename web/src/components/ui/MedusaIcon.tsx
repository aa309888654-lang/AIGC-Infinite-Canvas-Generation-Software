import { useMemo } from 'react'

const svgModules = import.meta.glob('/src/assets/icons/medusa/*.svg', { query: '?raw', eager: true })

const iconCache: Record<string, string> = {}
for (const [path, mod] of Object.entries(svgModules)) {
  const name = path.split('/').pop()?.replace('.svg', '') || ''
  const content = typeof mod === 'string' ? mod : (mod as any)?.default ?? String(mod ?? '')
  if (typeof content === 'string' && content.length > 0) {
    iconCache[name] = content
  }
}

interface MedusaIconProps {
  name: string
  size?: number
  className?: string
  style?: React.CSSProperties
}

export default function MedusaIcon({ name, size = 15, className = '', style }: MedusaIconProps) {
  const svgHtml = useMemo(() => {
    const raw = iconCache[name]
    if (!raw || typeof raw !== 'string') return null
    return raw
      .replace(/width="15"/, `width="${size}"`)
      .replace(/height="15"/, `height="${size}"`)
      .replace(/stroke="#18181B"/g, 'stroke="currentColor"')
  }, [name, size])

  if (!svgHtml) return null

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size, lineHeight: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  )
}

export const ICON_NAMES = Object.keys(iconCache)
