// A short wait, for retrying after a busy moment.
export const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
