export default function VICLogo({ size = 72, variant = 'header', alt = 'VIC logo' }) {
  const isHeader = variant === 'header'
  const isHero = variant === 'hero'
  const tileRadius = isHeader ? 16 : 18
  const logoScale = isHero ? 1.38 : 1.25

  return (
    <div
      style={{
        borderRadius: `${tileRadius}px`,
        padding: '4px',
        background: '#2B241F',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <img
        src="/vic-logo.png"
        alt={alt}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          maxWidth: 'none',
          maxHeight: 'none',
          objectFit: 'contain',
          transform: `scale(${logoScale})`,
          transformOrigin: 'center',
          display: 'block',
        }}
      />
    </div>
  )
}
