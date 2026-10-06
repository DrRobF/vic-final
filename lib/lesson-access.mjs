export const LESSON_CONSENT_VERSION='2026-10-06-v1'
export const LESSON_CONSENT_TEXT='I agree to receive teaching tips, Ask VIC updates, product offers, and workshop announcements from Dr. Rob Furman. I can unsubscribe at any time.'
export function verifiedLessonEmail(user){return Boolean(user?.email&&user?.email_confirmed_at&&!user?.is_anonymous)}
