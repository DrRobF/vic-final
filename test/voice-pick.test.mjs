import test from 'node:test'
import assert from 'node:assert/strict'
import { pickVoiceFor } from '../lib/voice-pick.mjs'

const v = (lang, localService = false, name = lang) => ({ lang, localService, name })

test('English keeps its forgiving fallback: any voice beats silence', () => {
 assert.equal(pickVoiceFor([v('fr-FR', true)], 'en').lang, 'fr-FR')
 assert.equal(pickVoiceFor([v('en-GB'), v('en-US', true)], 'en').lang, 'en-US')
})

test('Spanish prefers US Spanish, then Mexican, then any Spanish', () => {
 assert.equal(pickVoiceFor([v('es-ES'), v('es-MX'), v('es-US')], 'es').lang, 'es-US')
 assert.equal(pickVoiceFor([v('es-ES'), v('es-MX')], 'es').lang, 'es-MX')
 assert.equal(pickVoiceFor([v('en-US'), v('es-ES')], 'es').lang, 'es-ES')
})

test('Spanish is never read with an English voice', () => {
 assert.equal(pickVoiceFor([v('en-US', true), v('en-GB')], 'es'), null)
})

test('Haitian Creole is never read with a French voice', () => {
 // A French voice sounds almost right and teaches wrong sounds, which is worse than silence.
 assert.equal(pickVoiceFor([v('fr-FR', true), v('fr-CA'), v('en-US')], 'ht'), null)
 assert.equal(pickVoiceFor([v('ht-HT')], 'ht').lang, 'ht-HT')
})

test('an empty voice list is no voice, in any language', () => {
 for (const l of ['en', 'es', 'ht']) assert.equal(pickVoiceFor([], l), null)
 assert.equal(pickVoiceFor(undefined, 'es'), null)
})

test('prefers an on-device voice within a language', () => {
 assert.equal(pickVoiceFor([v('es-US', false, 'cloud'), v('es-US', true, 'local')], 'es').name, 'local')
})
