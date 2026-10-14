// The "future classroom" picture: a teacher with one group, VIC at the center, and every student
// connected at their own level. Pure SVG in the Midnight Circuit palette; motion stops for reduced-motion users.
export default function HeroGraphic({ variant = 'home' }) {
 const vic = variant === 'vic'
 const students = [
  { x: 470, y: 120, c: '#0EA5E9', label: 'Support' },
  { x: 500, y: 250, c: '#10B981', label: 'On level' },
  { x: 470, y: 380, c: '#F59E0B', label: 'Enrichment' },
 ]
 return <figure className="hg" aria-label={vic ? 'Diagram: the teacher works with one group while VIC teaches the other students the same goal at their level' : 'Illustration: a teacher, VIC and students connected in one classroom network'}>
  <svg viewBox="0 0 600 500" role="img" aria-hidden="true">
   <defs>
    <linearGradient id="hg-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#101C44" /><stop offset="1" stopColor="#0A1330" /></linearGradient>
    <radialGradient id="hg-core" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#A78BFA" /><stop offset=".55" stopColor="#5B21B6" /><stop offset="1" stopColor="#5B21B6" stopOpacity="0" /></radialGradient>
    <pattern id="hg-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#2A3A6E" /></pattern>
    <filter id="hg-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
   </defs>
   <rect x="0" y="0" width="600" height="500" rx="28" fill="url(#hg-bg)" />
   <rect x="0" y="0" width="600" height="500" rx="28" fill="url(#hg-dots)" opacity=".7" />

   {/* circuit traces */}
   <g fill="none" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" opacity=".85">
    <path className="trace" d="M150 250 H230 L255 225 H300" />
    {students.map((s, i) => <path key={i} className="trace" style={{ animationDelay: `${i * 0.6}s` }} d={`M300 250 L340 ${250 + (s.y - 250) * 0.35} H${s.x - 70} L${s.x - 34} ${s.y}`} />)}
   </g>
   <g fill="none" stroke="#2A3A6E" strokeWidth="1.5">
    <path d="M60 80 H180 L200 100 H260" /><path d="M340 470 H420 L440 450 H560" /><path d="M40 420 H120 L140 400" /><path d="M420 40 H560" />
   </g>

   {/* teacher + small group */}
   <g>
    <circle cx="110" cy="250" r="54" fill="#16224A" stroke="#2563EB" strokeWidth="3" />
    <circle cx="110" cy="232" r="14" fill="#2563EB" />
    <path d="M84 276c4-18 14-26 26-26s22 8 26 26" fill="#2563EB" />
    {[[60, 330], [110, 345], [160, 330]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="9" fill="#DCE7FF" /><path d={`M${x - 12} ${y + 22}c2-9 6-13 12-13s10 4 12 13`} fill="#DCE7FF" /></g>)}
    <rect x="44" y="372" width="132" height="30" rx="15" fill="#0A1330" stroke="#2563EB" />
    <text x="110" y="392" textAnchor="middle" fontFamily="Manrope, sans-serif" fontSize="14" fontWeight="800" fill="#E8EEFF">Teacher + group</text>
   </g>

   {/* VIC core */}
   <g filter="url(#hg-glow)">
    <circle className="pulse" cx="300" cy="250" r="78" fill="url(#hg-core)" opacity=".55" />
    <circle cx="300" cy="250" r="46" fill="#5B21B6" stroke="#A78BFA" strokeWidth="3" />
    <text x="300" y="266" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontSize="44" fontWeight="700" fill="#fff">V</text>
   </g>
   <circle className="orbit" cx="300" cy="250" r="66" fill="none" stroke="#A78BFA" strokeWidth="1.5" strokeDasharray="4 10" />
   <text x="300" y="338" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="13" fill="#A9B6D8" letterSpacing="2">VIC · CO-TEACHER</text>

   {/* students at their level */}
   {students.map((s, i) => <g key={i}>
    <circle cx={s.x} cy={s.y} r="30" fill="#16224A" stroke={s.c} strokeWidth="3" />
    <circle cx={s.x} cy={s.y - 8} r="8" fill={s.c} />
    <path d={`M${s.x - 13} ${s.y + 16}c2-9 7-13 13-13s11 4 13 13`} fill={s.c} />
    <text x={s.x} y={s.y + 50} textAnchor="middle" fontFamily="Manrope, sans-serif" fontSize="13" fontWeight="800" fill={s.c}>{s.label}</text>
   </g>)}

   {/* floating status chips */}
   <g className="float">
    <rect x="166" y="58" width="230" height="40" rx="12" fill="#C6F432" />
    <text x="281" y="83" textAnchor="middle" fontFamily="Manrope, sans-serif" fontSize="15" fontWeight="800" fill="#0A1330">{vic ? '✓ Same goal, new angle' : '✓ Lesson ready for Monday'}</text>
   </g>
   <g className="float2">
    <rect x="196" y="410" width="210" height="40" rx="12" fill="#0A1330" stroke="#22D3EE" />
    <text x="301" y="435" textAnchor="middle" fontFamily="Manrope, sans-serif" fontSize="14" fontWeight="800" fill="#22D3EE">{vic ? 'Teacher sees every student' : 'Week sent to principal'}</text>
   </g>
  </svg>
  <style jsx>{`
   .hg{margin:0;width:100%;max-width:600px;justify-self:center}
   svg{width:100%;height:auto;display:block;border-radius:28px;box-shadow:0 30px 70px rgba(10,19,48,.35)}
   .trace{stroke-dasharray:8 10;animation:flow 2.4s linear infinite}
   .pulse{transform-origin:300px 250px;animation:pulse 3.2s ease-in-out infinite}
   .orbit{transform-origin:300px 250px;animation:spin 18s linear infinite}
   .float{animation:bob 5s ease-in-out infinite}
   .float2{animation:bob 6s ease-in-out infinite reverse}
   @keyframes flow{to{stroke-dashoffset:-36}}
   @keyframes pulse{0%,100%{transform:scale(1);opacity:.45}50%{transform:scale(1.12);opacity:.75}}
   @keyframes spin{to{transform:rotate(360deg)}}
   @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
   @media (prefers-reduced-motion: reduce){.trace,.pulse,.orbit,.float,.float2{animation:none}}
  `}</style>
 </figure>
}
