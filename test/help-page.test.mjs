import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../pages/help.js', import.meta.url), 'utf8')
const header = readFileSync(new URL('../components/VICHeader.js', import.meta.url), 'utf8')

test('help has the three tabs and deep links', () => {
  for (const id of ['tour', 'start', 'stuck']) assert.match(page, new RegExp(`id: '${id}'`))
  assert.match(page, /window\.location\.hash/)
  assert.match(page, /role="tablist"/)
})

test('every signed-in or visitor header shows Help', () => {
  const help = header.indexOf('href="/help"')
  assert.ok(help > 0)
  const before = header.slice(Math.max(0, help - 200), help)
  assert.doesNotMatch(before, /authUser &&\s*<a className=\{currentPath === '\/help'/, 'Help must not be hidden behind sign-in')
})

test('help answers the problems teachers actually hit', () => {
  assert.match(page, /askvic\.ai\/join/)
  assert.match(page, /lessonplan\/week/)
  assert.match(page, /activity sequence was incomplete/)
  assert.match(page, /student-login/)
  assert.match(page, /safety alert/i)
})

test('help points only to pages that exist', () => {
  for (const route of [...page.matchAll(/href="(\/[a-z/-]*)"/g)].map(m => m[1])) {
    const file = route === '/' ? 'index' : route.slice(1)
    assert.ok([`../pages/${file}.js`, `../pages/${file}/index.js`].some(f => { try { readFileSync(new URL(f, import.meta.url)); return true } catch { return false } }), route)
  }
})
