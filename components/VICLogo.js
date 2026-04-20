const DARK_TILE = '#2B241F'

const VARIANT_STYLES = {
  header: {
    shellRadius: 16,
    shellPadding: 12,
    shellShadow: '0 12px 26px rgba(43, 36, 31, 0.34)',
    logoScale: 0.9,
  },
  hero: {
    shellRadius: 20,
    shellPadding: 16,
    shellShadow: '0 16px 34px rgba(43, 36, 31, 0.36)',
    logoScale: 0.9,
  },
  card: {
    shellRadius: 16,
    shellPadding: 10,
    shellShadow: '0 12px 26px rgba(43, 36, 31, 0.3)',
    logoScale: 0.88,
  },
}

export default function VICLogo({ size = 72, variant = 'header', alt = 'VIC logo' }) {
  const config = VARIANT_STYLES[variant] || VARIANT_STYLES.header
  const logoSize = Math.round(size * config.logoScale)

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${config.shellRadius}px`,
        padding: `${config.shellPadding}px`,
        background: DARK_TILE,
        boxShadow: config.shellShadow,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      <img
        src="/vic-logo.png"
        alt={alt}
        style={{
          width: `${logoSize}px`,
          height: `${logoSize}px`,
          objectFit: 'contain',
          display: 'block',
          opacity: 1,
          filter: 'none',
        }}
      />
    </div>
  )
}
