import { useEffect, useState } from 'react'
import { TEXT_SIZES, readTextSize, saveTextSize } from '../lib/text-size'

// A · A · A: lets anyone make the whole page smaller or larger. Remembered in this browser.
export default function TextSizeControl({ tone = 'light' }) {
 const [value, setValue] = useState('normal')
 useEffect(() => { setValue(readTextSize()) }, [])
 return <div role="group" aria-label="Text size" className={`tsc ${tone}`}>
  {TEXT_SIZES.map(s => <button key={s.key} type="button" aria-label={s.label} aria-pressed={value === s.key} onClick={() => setValue(saveTextSize(s.key))} style={{ fontSize: s.size }}>A</button>)}
  <style jsx>{`
   .tsc{display:flex;align-items:center;gap:2px;padding:3px;border-radius:10px;border:1px solid var(--vic-border)}
   .tsc.dark{border-color:var(--vic-ink-line);background:var(--vic-ink-2)}
   button{width:34px;height:34px;border:0;border-radius:8px;background:transparent;color:var(--vic-text-primary);font-family:var(--font-body);font-weight:800;line-height:1;cursor:pointer}
   .dark button{color:var(--vic-ink-text)}
   button[aria-pressed=true]{background:var(--vic-primary);color:#fff}
  `}</style>
 </div>
}
