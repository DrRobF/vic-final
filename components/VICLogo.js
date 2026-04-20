export default function VICLogo({ size = 72, variant = 'header', alt = 'VIC logo' }) {
  const isHeader = variant === 'header'
  const tileRadius = isHeader ? 16 : 18

  return (
    <div
      style={{
        borderRadius: `${tileRadius}px`,
        padding: '8px',
        background: '#2B241F',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <img
        src="/vic-logo.png"
        alt={alt}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </div>
  )
}
