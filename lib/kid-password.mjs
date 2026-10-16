// Passwords a young student can actually type: two easy words and two digits, like "happy-tiger-47".
//
// The old generator made 16 random characters (randomBytes(12).toString('base64url')), such as
// "WSPlgBa0bEl6a_y1": mixed case, 0 next to O, l next to I, and an underscore. Fine for a robot,
// hopeless for a second grader.
//
// Rules: all lowercase (no Shift key), short words a child can sound out and spell, no letters
// or digits that look alike (digits are 2–9, so no 0/O or 1/l), nothing scary or rude.
// About 640,000 combinations (100 × 100 words × 64 number pairs). Student sign-in is also rate limited by Supabase Auth, and
// admins can reset a forgotten password at any time.

import { randomInt } from 'node:crypto'

export const KID_ADJECTIVES = [
  'happy', 'brave', 'sunny', 'jolly', 'quick', 'calm', 'bold', 'kind', 'shiny', 'lucky',
  'fuzzy', 'silly', 'swift', 'proud', 'gentle', 'merry', 'clever', 'bright', 'cozy', 'eager',
  'fancy', 'giant', 'grand', 'tiny', 'wild', 'zippy', 'noble', 'super', 'mighty', 'magic',
  'red', 'blue', 'green', 'gold', 'pink', 'purple', 'orange', 'silver', 'yellow', 'teal',
  'cool', 'warm', 'fresh', 'sweet', 'lively', 'neat', 'perky', 'plucky', 'rosy', 'snappy',
  'sparkly', 'speedy', 'spicy', 'starry', 'sturdy', 'witty', 'cheery', 'daring', 'dreamy', 'friendly',
  'frosty', 'funny', 'glad', 'jumpy', 'loyal', 'misty', 'peppy', 'polite', 'rapid', 'royal',
  'smart', 'smooth', 'snowy', 'soft', 'steady', 'stormy', 'strong', 'sunlit', 'trusty', 'windy',
  'busy', 'chill', 'curly', 'dandy', 'fluffy', 'groovy', 'handy', 'hearty', 'humble', 'jazzy',
  'keen', 'lofty', 'mellow', 'nifty', 'quiet', 'rocky', 'sandy', 'spotty', 'stripy', 'zesty',
]

export const KID_NOUNS = [
  'tiger', 'panda', 'otter', 'eagle', 'koala', 'zebra', 'whale', 'shark', 'llama', 'moose',
  'robin', 'puppy', 'kitten', 'bunny', 'turtle', 'dolphin', 'falcon', 'parrot', 'beaver', 'badger',
  'rocket', 'planet', 'comet', 'star', 'moon', 'cloud', 'river', 'ocean', 'forest', 'island',
  'apple', 'mango', 'lemon', 'peach', 'cherry', 'banana', 'cookie', 'muffin', 'waffle', 'pickle',
  'drum', 'guitar', 'piano', 'trumpet', 'violin', 'banjo', 'kazoo', 'flute', 'tuba', 'harp',
  'pencil', 'crayon', 'marker', 'paper', 'robot', 'castle', 'wagon', 'kite', 'balloon', 'bubble',
  'dragon', 'wizard', 'pirate', 'knight', 'unicorn', 'giant', 'hero', 'ranger', 'captain', 'pilot',
  'acorn', 'pebble', 'maple', 'tulip', 'daisy', 'cactus', 'clover', 'meadow', 'canyon', 'valley',
  'soccer', 'hockey', 'tennis', 'skate', 'scooter', 'bike', 'sled', 'boat', 'train', 'truck',
  'button', 'mitten', 'sock', 'hat', 'pillow', 'blanket', 'lantern', 'compass', 'treasure', 'puzzle',
]

const DIGITS = '23456789'

export function kidPassword(pick = randomInt) {
  const adjective = KID_ADJECTIVES[pick(KID_ADJECTIVES.length)]
  let noun = KID_NOUNS[pick(KID_NOUNS.length)]
  // "giant" is in both lists; avoid "giant-giant".
  while (noun === adjective) noun = KID_NOUNS[pick(KID_NOUNS.length)]
  return `${adjective}-${noun}-${DIGITS[pick(DIGITS.length)]}${DIGITS[pick(DIGITS.length)]}`
}
