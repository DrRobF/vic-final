import test from 'node:test'
import assert from 'node:assert/strict'
import {requestedBehavior} from '../lib/lesson-behavior.mjs'
test('Explicit natural-language revision overrides the saved approach and converts the current draft',()=>{
 const r=requestedBehavior({startingPoint:'new',lessonStyle:'socratic',creativeActivity:'none',previousPlan:'Current ratios lesson with six questions.',revision:'Make this an inquiry lesson and add a collaborative challenge.'})
 assert.equal(r.lessonStyle,'inquiry');assert.equal(r.creativeActivity,'group');assert.equal(r.startingPoint,'convert');assert.equal(r.sourceLesson,'Current ratios lesson with six questions.');assert.equal(r.preserveExisting,false)
})
test('References, negations and requests to preserve an approach do not switch it',()=>{
 for(const revision of ['Do not use inquiry.','Keep the socratic questions.','The inquiry example is interesting.','Without a group challenge.'])assert.equal(requestedBehavior({lessonStyle:'explicit',creativeActivity:'none',revision}).lessonStyle,'explicit')
})
test('An uploaded lesson gets the requested style without losing its original source',()=>{
 const r=requestedBehavior({startingPoint:'refresh',sourceLesson:'Uploaded lesson.',lessonStyle:'recommend',revision:'Convert it to project-based learning.'})
 assert.equal(r.lessonStyle,'project');assert.equal(r.sourceLesson,'Uploaded lesson.')
})

test('Keeping other details does not suppress an explicitly requested new approach',()=>{assert.equal(requestedBehavior({lessonStyle:'socratic',revision:'Keep everything else the same but make this inquiry.'}).lessonStyle,'inquiry')})
