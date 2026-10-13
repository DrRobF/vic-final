import test from 'node:test'
import assert from 'node:assert/strict'
import { plainText } from '../lib/lesson-companion.mjs'
test('companion drafts lose Markdown but keep math', () => {
 assert.equal(plainText('### Prep\n**Bold** and *it*.\n---\n* item\nend 3*4*5 and 2 * 3'), 'Prep\nBold and it.\n\n- item\nend 3*4*5 and 2 * 3')
})
