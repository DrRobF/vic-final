export function requiresPasswordChange(user) {
  return user?.app_metadata?.must_change_password === true
}

export function newPasswordError(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Choose a password with at least 8 characters.'
  if (new TextEncoder().encode(password).length > 72) return 'Choose a password no longer than 72 bytes.'
  return null
}
