export const LESSON_CONSENT_VERSION='2026-10-09-v2'
export const LESSON_TERMS_TEXT='I am an adult educator, and I agree to the Ask VIC Terms of Use and Privacy Policy.'
// Updates are a separate yes/no choice. Saying no never limits access to Ask VIC.
export const LESSON_CONSENT_TEXT='I agree to receive teaching tips, Ask VIC updates, product offers, and workshop announcements from Dr. Rob Furman. I can unsubscribe at any time.'
export function verifiedLessonEmail(user){return Boolean(user?.email&&user?.email_confirmed_at&&!user?.is_anonymous)}

export function signupConsentRecord(updates){
 return {consent_text:`${LESSON_TERMS_TEXT} Email updates: ${updates?`YES. ${LESSON_CONSENT_TEXT}`:'NO. Does not want marketing email.'}`,consent_version:LESSON_CONSENT_VERSION}
}
