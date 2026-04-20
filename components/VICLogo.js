const VARIANT_STYLES = {
  header: {
    shellRadius: 18,
    shellPadding: 8,
    shellBorder: '1px solid rgba(181, 83, 47, 0.28)',
    shellShadow: '0 10px 22px rgba(43, 36, 31, 0.16)',
  },
  hero: {
    shellRadius: 24,
    shellPadding: 14,
    shellBorder: '1px solid rgba(181, 83, 47, 0.3)',
    shellShadow: '0 16px 34px rgba(43, 36, 31, 0.2)',
  },
  card: {
    shellRadius: 16,
    shellPadding: 8,
    shellBorder: '1px solid rgba(181, 83, 47, 0.26)',
    shellShadow: '0 10px 24px rgba(43, 36, 31, 0.15)',
  },
}

export default function VICLogo({ size = 72, variant = 'header', alt = 'VIC logo' }) {
  const config = VARIANT_STYLES[variant] || VARIANT_STYLES.header
  const logoSize = Math.round(size * 0.78)
  const imagePadding = Math.max(6, Math.round(logoSize * 0.1))

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${config.shellRadius}px`,
        padding: `${config.shellPadding}px`,
        background: 'linear-gradient(180deg, #efe3d2 0%, #e5d1bf 100%)',
        border: config.shellBorder,
        boxShadow: config.shellShadow,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <img
        src="/vic-logo.png"
        alt={alt}
        style={{
          width: `${logoSize}px`,
          height: `${logoSize}px`,
          borderRadius: `${Math.max(10, Math.round(config.shellRadius * 0.7))}px`,
          background: '#fffdf9',
          border: '1px solid rgba(181, 83, 47, 0.2)',
          padding: `${imagePadding}px`,
          objectFit: 'contain',
          display: 'block',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
