// The room shelf. A room is a prop list, not a picture.
//
// VIC teaches blind unless she knows what is around the child. A manifest says what is
// in the room, where it is, and what each thing is good for teaching -- so VIC can say
// "turn around and look at that", and can notice the child never did.
//
// A room that is a LIST can be aimed at any standard, so one room serves many lessons.
// That is the engine. See docs/virtual-room-spec.md.
//
// Positions: x is degrees across the panorama (0-360), y is percent down from the top
// (0 top, 100 bottom). Open a room with ?place=1 to click props into place and get
// coordinates to paste here -- far more accurate than guessing.

export const ROOMS = {
 'mars-gale-crater': {
  title: 'Mars — Gale Crater',
  where: "Standing where NASA's Curiosity rover stands, on the floor of Gale Crater.",
  // Real full 360 panorama stitched by JPL from 26 navigation-camera frames.
  // NASA content is generally not copyrighted and free for educational use.
  // TODO: download this to /public/rooms/mars-gale-crater.jpg and point image at
  // '/rooms/mars-gale-crater.jpg' -- hotlinking NASA is fine for a prototype, not for a classroom.
  image: 'https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia16/pia16074/PIA16074.jpg',
  credit: 'NASA/JPL-Caltech',
  source: 'https://science.nasa.gov/photojournal/all-around-curiosity/',
  real: true,
  // POSITIONS ARE UNVERIFIED GUESSES. Nobody has looked at this image yet and placed
  // them. Open /room?place=1, click each thing where it actually is, paste the numbers.
  propsVerified: false,
  props: [
   { id: 'mount-sharp', name: 'Mount Sharp', x: 95, y: 44,
     note: 'The mountain in the middle of the crater. Its layers are stacked like pages in a book.',
     teaches: ['layers and time', 'measurement at a distance', 'comparing heights'] },
   { id: 'crater-rim', name: 'The crater rim', x: 250, y: 47,
     note: 'The far wall of the crater. Something big hit here a very long time ago.',
     teaches: ['scale and distance', 'cause and effect', 'what made this hole'] },
   { id: 'rover-deck', name: "The rover's own deck", x: 180, y: 78,
     note: 'Part of Curiosity is in the picture, because the camera is bolted to it.',
     teaches: ['point of view', 'how we know what we know', 'describing what you see'] },
   { id: 'wheel-tracks', name: 'Wheel tracks', x: 205, y: 86,
     note: 'The marks the rover left in the dust behind it.',
     teaches: ['measuring distance travelled', 'evidence of movement', 'patterns'] },
   { id: 'ground-rocks', name: 'Rocks on the ground', x: 40, y: 72,
     note: 'Loose rocks and gravel all around. Some are rounded, some are sharp.',
     teaches: ['sorting and classifying', 'what water does to rock', 'close observation'] },
   { id: 'martian-sky', name: 'The sky', x: 300, y: 18,
     note: 'A butterscotch sky. Dust in the air makes it that colour, not blue.',
     teaches: ['atmosphere', 'comparing Mars to Earth', 'why our sky is blue'] },
  ],
 },
}

export const roomIds = () => Object.keys(ROOMS)
export const getRoom = id => ROOMS[id] || null
export const DEFAULT_ROOM = 'mars-gale-crater'

// Degrees across the panorama -> fraction of the image width.
export const degToFraction = deg => (((Number(deg) || 0) % 360) + 360) % 360 / 360
