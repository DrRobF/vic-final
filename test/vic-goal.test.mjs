import test from 'node:test'
import assert from 'node:assert/strict'
import { extractGoal } from '../lib/vic-goal.mjs'
import { buildVicContext } from '../lib/ask-vic-context.mjs'
import { VIC_BRAIN } from '../lib/vic-brain.mjs'

test('the goal tag is read and removed before a student sees it', () => {
  assert.deepEqual(extractGoal('You did it!\n[[VIC_GOAL: met]]'), { text: 'You did it!', goal: 'met' })
  assert.equal(extractGoal('Keep going [[VIC_GOAL: not yet]]').goal, 'not_yet')
  assert.equal(extractGoal('Nice try\n[[VIC_GOAL: partly]]').goal, 'partly')
  assert.deepEqual(extractGoal('Just teaching.'), { text: 'Just teaching.', goal: null })
  assert.equal(extractGoal('x [[VIC_GOAL: amazing]]').goal, null)
})

test('a practice skill gets practice rules, not the co-teacher rules', () => {
  const ctx = buildVicContext({ mode: 'teacher_directed', lesson: { title: 'Practice: add fractions', lesson_text: 'MA.3.FR.1.2: Represent fractions', practice_standard: 'FL:MA.3.FR.1.2' }, assignmentMode: 'remediation', gradeLevel: 3 })
  assert.match(ctx, /PRACTICE SKILL/)
  assert.match(ctx, /ONE short problem at a time/)
  assert.doesNotMatch(ctx, /do not quiz or drill/)
  const lesson = buildVicContext({ mode: 'teacher_directed', lesson: { title: 'Fractions', lesson_text: 'Standard: x' }, gradeLevel: 3 })
  assert.match(lesson, /TEACHER LESSON/)
})

test('the brain explains the goal tag and keeps it out of My Own Work', () => {
  assert.match(VIC_BRAIN, /\[\[VIC_GOAL: met\]\]/)
  assert.match(VIC_BRAIN, /Never in My Own Work/)
})
