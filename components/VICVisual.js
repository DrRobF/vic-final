// The pictures VIC can show under a reply, plus light text formatting for VIC's messages.
//
// Every style lives in this file. The old renderer referenced nine style keys that were never
// defined, so fraction bars rendered with no size and only their caption text showed.
// Shaded parts use the primary blue with a stripe, so "shaded" never depends on telling red from
// green, and every picture has a plain-language caption for screen readers.

const ui = {
  card: { marginTop: 14, padding: '16px 18px', borderRadius: 14, border: '1px solid var(--vic-border)', background: 'var(--vic-surface)', display: 'grid', gap: 12, maxWidth: 520 },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  title: { fontSize: 13, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--vic-primary)' },
  badge: { fontSize: 15, fontWeight: 800, padding: '3px 10px', borderRadius: 8, background: 'var(--vic-primary-soft, rgba(29,78,216,.1))', color: 'var(--vic-primary)', fontVariantNumeric: 'tabular-nums' },
  caption: { margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--vic-text-secondary)' },
  bar: { display: 'flex', gap: 3, height: 44, width: '100%' },
  piece: { flex: 1, borderRadius: 6, border: '2px solid var(--vic-primary)', minWidth: 0 },
  label: { fontSize: 14, fontWeight: 700, color: 'var(--vic-text-primary)', fontVariantNumeric: 'tabular-nums', marginBottom: 6 },
  dots: { display: 'grid', gap: 8, width: 'fit-content' },
  dot: { width: 22, height: 22, borderRadius: '50%', background: 'var(--vic-primary)' },
}

const SHADED = 'repeating-linear-gradient(135deg, var(--vic-primary) 0 8px, color-mix(in srgb, var(--vic-primary) 82%, white) 8px 12px)'

function FractionBar({ numerator, denominator }) {
  return (
    <div style={ui.bar} role="img" aria-label={`${numerator} out of ${denominator} equal parts shaded`}>
      {Array.from({ length: denominator }, (_, i) => (
        <div key={i} style={{ ...ui.piece, background: i < numerator ? SHADED : 'transparent' }} />
      ))}
    </div>
  )
}

function NumberLine({ start, end, mark }) {
  const steps = end - start, w = 480, pad = 22, y = 34
  const x = n => pad + ((n - start) / steps) * (w - pad * 2)
  return (
    <svg viewBox={`0 0 ${w} 70`} width="100%" role="img" aria-label={`Number line from ${start} to ${end} with ${mark} marked`} style={{ overflow: 'visible' }}>
      <line x1={pad - 10} y1={y} x2={w - pad + 10} y2={y} stroke="var(--vic-text-secondary)" strokeWidth="2" />
      {Array.from({ length: steps + 1 }, (_, i) => start + i).map(n => (
        <g key={n}>
          <line x1={x(n)} y1={y - 8} x2={x(n)} y2={y + 8} stroke="var(--vic-text-secondary)" strokeWidth="2" />
          <text x={x(n)} y={y + 28} textAnchor="middle" fontSize="14" fontWeight={n === mark ? 800 : 500} fill={n === mark ? 'var(--vic-primary)' : 'var(--vic-text-secondary)'}>{n}</text>
        </g>
      ))}
      <circle cx={x(mark)} cy={y} r="9" fill="var(--vic-primary)" />
    </svg>
  )
}

export default function VICVisual({ visual }) {
  if (!visual?.type) return null

  if (visual.type === 'fraction') {
    const { numerator, denominator } = visual
    return (
      <figure style={ui.card}>
        <div style={ui.head}><span style={ui.title}>Fraction model</span><span style={ui.badge}>{numerator}/{denominator}</span></div>
        <FractionBar numerator={numerator} denominator={denominator} />
        <figcaption style={ui.caption}>{numerator} out of {denominator} equal parts are shaded.</figcaption>
      </figure>
    )
  }

  if (visual.type === 'compare') {
    const [a, b] = visual.fractions
    return (
      <figure style={ui.card}>
        <div style={ui.head}><span style={ui.title}>Compare</span><span style={ui.badge}>{a.numerator}/{a.denominator} and {b.numerator}/{b.denominator}</span></div>
        {[a, b].map((f, i) => (
          <div key={i}>
            <div style={ui.label}>{f.numerator}/{f.denominator}</div>
            <FractionBar {...f} />
          </div>
        ))}
        <figcaption style={ui.caption}>Same-size bars, so you can see which shaded part is bigger, or whether they match.</figcaption>
      </figure>
    )
  }

  if (visual.type === 'numberline') {
    return (
      <figure style={ui.card}>
        <div style={ui.head}><span style={ui.title}>Number line</span><span style={ui.badge}>{visual.mark}</span></div>
        <NumberLine {...visual} />
      </figure>
    )
  }

  if (visual.type === 'array') {
    const { rows, columns } = visual
    return (
      <figure style={ui.card}>
        <div style={ui.head}><span style={ui.title}>Array</span><span style={ui.badge}>{rows} × {columns}</span></div>
        <div style={{ ...ui.dots, gridTemplateColumns: `repeat(${columns}, 22px)` }} role="img" aria-label={`${rows} rows of ${columns} dots`}>
          {Array.from({ length: rows * columns }, (_, i) => <div key={i} style={ui.dot} />)}
        </div>
        <figcaption style={ui.caption}>{rows} rows with {columns} in each row.</figcaption>
      </figure>
    )
  }

  if (visual.type === 'tip' && visual.body) {
    return (
      <div style={ui.card}>
        <span style={ui.title}>{visual.title || 'Quick tip'}</span>
        <p style={ui.caption}>{visual.body}</p>
      </div>
    )
  }

  return null
}

// VIC sometimes writes **bold**. Show it as bold instead of literal asterisks.
export function VICText({ text }) {
  const parts = String(text || '').split(/(\*\*[^*\n]+?\*\*)/g)
  return parts.map((part, i) => /^\*\*[^*\n]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : part)
}
