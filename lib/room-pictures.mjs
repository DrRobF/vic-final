// The secret pictures students tap to log in. Big, familiar, easy to tell apart, no reading needed.
// Safe to import in the browser.
export const PICTURES = [
 { key: 'dog', emoji: '🐶', label: 'Dog' },
 { key: 'cat', emoji: '🐱', label: 'Cat' },
 { key: 'apple', emoji: '🍎', label: 'Apple' },
 { key: 'star', emoji: '⭐', label: 'Star' },
 { key: 'rocket', emoji: '🚀', label: 'Rocket' },
 { key: 'rainbow', emoji: '🌈', label: 'Rainbow' },
 { key: 'ball', emoji: '⚽', label: 'Ball' },
 { key: 'guitar', emoji: '🎸', label: 'Guitar' },
 { key: 'turtle', emoji: '🐢', label: 'Turtle' },
 { key: 'pizza', emoji: '🍕', label: 'Pizza' },
 { key: 'flower', emoji: '🌻', label: 'Flower' },
 { key: 'butterfly', emoji: '🦋', label: 'Butterfly' },
]
export const PICTURE_KEYS = PICTURES.map(p => p.key)
export const pictureFor = key => PICTURES.find(p => p.key === key) || null
export const ROOM_CODE = /^[A-Z0-9]{6}$/
export const cleanRoomCode = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
