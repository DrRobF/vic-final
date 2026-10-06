import test from 'node:test'
import assert from 'node:assert/strict'
import {prepareTeachingKit,supplyScaledPictograph,calculationWarnings,resourceWarnings} from '../lib/lesson-quality.mjs'
import {lessonOutputSections,planAsText} from '../lib/lesson-designer.mjs'
import {applySectionReplacement} from '../lib/lesson-section.mjs'
import {readableMaterialReferences,materializeTeachingKit} from '../lib/lesson-materials.mjs'
const source='In a survey of 30 students:\n| Flavor | Number of Students |\n| --- | --- |\n| Chocolate | 12 |\n| Vanilla | 9 |\n| Strawberry | 6 |\n| Mint | 3 |\nEach picture in the scaled pictograph represents 3 students.'
test('Supplied values and explicit scale become an actual printable pictograph without inventing values',()=>{
 const result=supplyScaledPictograph(source)
 assert.match(result,/Vanilla: ● ● ● \(9\)/);assert.match(result,/Chocolate: ● ● ● ● \(12\)/)
 assert.equal(supplyScaledPictograph(result),result)
 assert.equal(supplyScaledPictograph('Please provide a pictograph.'),'Please provide a pictograph.')
 assert.equal(supplyScaledPictograph(source.replace('represents 3','represents 4')),source.replace('represents 3','represents 4'))
})
test('An unequivocal wrong verbal fraction is corrected from the actual population, preserving the input',()=>{
 const original={sourceMaterial:source,discussionGuide:{questions:[{question:'How many pictures represent vanilla?',responseType:'calculation',sampleResponse:'9 divided by 3 is 3 pictures. This shows one-third of the class likes vanilla.'}]},assessment:{items:[]}}
 const {kit,notes}=prepareTeachingKit(original)
 assert.match(kit.discussionGuide.questions[0].sampleResponse,/3\/10 of the class/)
 assert.match(original.discussionGuide.questions[0].sampleResponse,/one-third/);assert.equal(notes.length,1)
})
test('Fraction equivalence checks work for numeric reasoning in any subject and leave open-ended responses alone',()=>{
 for(const context of ['math','science','music']){
  const original={sourceMaterial:context,discussionGuide:{questions:[{responseType:'calculation',sampleResponse:'9/30 simplifies to 1/3.'},{responseType:'inference',sampleResponse:'One-third of the class may prefer this interpretation.'}]},assessment:{items:[]}}
  const {kit}=prepareTeachingKit(original);assert.equal(kit.discussionGuide.questions[0].sampleResponse,'9/30 simplifies to 3/10.');assert.equal(kit.discussionGuide.questions[1].sampleResponse,original.discussionGuide.questions[1].sampleResponse)
 }
 assert.equal(calculationWarnings('12/30 = 2/5').length,0);assert.equal(calculationWarnings('9/30 = 1/3').length,1)
})
test('Calculation reasoning does not require a fabricated verbatim quotation',()=>{
 const kit={sourceMaterial:'Total 12; group A has 3.',teacherModel:'Worked example.',studentTask:'Write a fraction.',supports:'Counters.',discussionGuide:{norms:'Explain.',questions:[{question:'What fraction is A?',followUp:'Why?',sampleResponse:'3/12 = 1/4.',responseType:'calculation',sourceEvidence:'Derived fraction: 1/4'}]},assessment:'Explain your work.'}
 const result=materializeTeachingKit(kit);assert.match(result.discussionGuide,/Worked reasoning/);assert.doesNotMatch(result.discussionGuide,/citation could not be verified/)
})
test('Legacy assessment edits and new rewrites each export once, with no stale parallel assessment',()=>{
 const input={state:'FL',grade:'3',subject:'math',minutes:45,standards:[{code:'TEST',text:'Interpret data.'}]}
 const plan={title:'Data',sections:[{heading:'Assessment and exit ticket',body:'Summary assessment'},{heading:'District reflection',body:'Keep this heading'}],teachingKit:{assessment:'Question, teacher answer and success criteria'},alignment:[],reviewNotes:[],displayEdits:{section_0:'Sticker exit ticket with answers and criteria'}}
 assert.equal(lessonOutputSections(plan,input).filter(s=>/assessment|exit ticket/i.test(s.heading)).length,1)
 assert.doesNotMatch(planAsText(plan,input),/Summary assessment|Question, teacher answer/)
 const draft=applySectionReplacement({input,plan},'section_0','Oral exit ticket with evidence and criteria')
 assert.match(planAsText(draft.plan,input),/Oral exit ticket/);assert.doesNotMatch(planAsText(draft.plan,input),/Sticker exit ticket/)
 assert.ok(lessonOutputSections(plan,input).some(s=>s.heading==='District reflection'))
})
test('Materials references become plain labels without rewriting ordinary assessment prose',()=>{
 assert.equal(readableMaterialReferences('Session 1 sourceMaterial; studentTask organizers["Fraction Chart"]; studentTask individualWork'),'Session 1 Shared text / lesson stimulus; Fraction Chart; Each student\'s own work (Student task and handouts)')
 assert.equal(readableMaterialReferences('New performance assessment supports the objective.'),'New performance assessment supports the objective.')
})
test('Missing extension datasets are identified while supplied values are accepted',()=>{
 assert.match(resourceWarnings({sourceMaterial:'A source.',supports:'Additional survey data from another class.'}).join(' '),/without supplying its values/)
 assert.deepEqual(resourceWarnings({sourceMaterial:source,supports:'Additional data:\n| Item | Count |\n|---|---|\n| A | 2 |\n| B | 4 |'}).filter(s=>s.includes('extension')),[])
})
