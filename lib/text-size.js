// The A · A · A text-size setting. Stored in this browser; applied to the whole page.
export const TEXT_SIZES = [
 { key: 'small', label: 'Smaller text', size: 13 },
 { key: 'normal', label: 'Normal text', size: 16 },
 { key: 'large', label: 'Larger text', size: 20 },
]
const KEY = 'askvic-text-size'
export function readTextSize() {
 try { const v = localStorage.getItem(KEY); return TEXT_SIZES.some(s => s.key === v) ? v : 'normal' } catch { return 'normal' }
}
export function applyTextSize(value = readTextSize()) {
 if (typeof document === 'undefined') return value
 if (value === 'normal') document.documentElement.removeAttribute('data-text-size')
 else document.documentElement.setAttribute('data-text-size', value)
 return value
}
export function saveTextSize(value) {
 try { localStorage.setItem(KEY, value) } catch {}
 return applyTextSize(value)
}
