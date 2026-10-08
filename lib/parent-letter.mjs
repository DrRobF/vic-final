export const LETTER_STATEMENTS={
 joy:'A delight to have in class',
 effort:'Shows persistence with challenging work',
 curiosity:'Asks thoughtful questions',
 kindness:'Contributes kindness to our classroom',
 confidence:'Is growing in confidence',
 participation:'Is becoming more involved in learning',
 practice:'Would benefit from regular practice at home',
 focus:'Is working on staying focused during learning',
 collaboration:'Is working on collaboration with classmates',
 routines:'Is working on classroom routines and choices',
 completion:'Is working on completing assignments consistently',
}
export function letterInputs(raw){
 const includeVic=raw?.includeVic===true
 const includeVicReport=raw?.includeVicReport===true
 const lessonIds=Array.isArray(raw?.lessonIds)?[...new Set(raw.lessonIds)]:[]
 const familyIds=Array.isArray(raw?.familyIds)?[...new Set(raw.familyIds)]:[]
 const statements=Array.isArray(raw?.statements)?[...new Set(raw.statements)]:[]
 const notes=typeof raw?.notes==='string'?raw.notes.trim():''
 const classNote=typeof raw?.classNote==='string'?raw.classNote.trim():''
 if(lessonIds.length>5||lessonIds.some(id=>typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)))throw new Error('Choose up to five saved lessons.')
 if(familyIds.length>5||familyIds.some(id=>typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)))throw new Error('Choose up to five saved family updates.')
 if(statements.length>6||statements.some(id=>!Object.hasOwn(LETTER_STATEMENTS,id)))throw new Error('Choose up to six suggested statements.')
 if(notes.length>1500||classNote.length>1500)throw new Error('Keep each note under 1,500 characters.')
 if(!includeVic&&!includeVicReport&&!lessonIds.length&&!familyIds.length&&!statements.length&&!notes&&!classNote)throw new Error('Choose at least one source for this letter.')
 return {includeVic,includeVicReport,lessonIds,familyIds,statements,notes,classNote}
}
export function validParentEmail(value){return typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}
export function atHomeActivity({name,lessons=[],familyUpdates=[],vicReport=null}){
 const first=String(name||'your child').trim().split(/\s+/)[0]
 const familyGoal=familyUpdates.map(u=>String(u.draft||'').match(/This lesson focuses on:\s*([^\n]+)/i)?.[1]).find(Boolean)
 const goal=String(lessons.flatMap(l=>l.objectives||[])[0]||familyGoal||vicReport?.primaryAreaForGrowth||lessons[0]?.title||'').replace(/\s+/g,' ').trim().slice(0,180)
 if(/read|text|story|character|vocab|word|literacy|writing|evidence/i.test(goal)){
  return `At-home activity: Read a short passage or a page of a book together. Ask ${first} to find one example connected to our goal, “${goal},” and explain the words or details that support it.`
 }
 if(/math|number|fraction|measure|add|subtract|multiply|divide|geometry|shape|count/i.test(goal)){
  return `At-home activity: Use numbers or objects around your home to make one example of our goal, “${goal}.” Ask ${first} to show how they worked it out and explain their thinking.`
 }
 if(goal)return `At-home activity: Ask ${first} to teach you one idea from our goal, “${goal}.” Together, find or draw one example and ask how it connects to what they learned.`
 return `At-home activity: Ask ${first} to teach you one idea they are working on in class. Have them show or draw an example, then ask what they would like to practice next.`
}
export function includeAtHomeActivity(letter,context){
 return {...letter,body:`${String(letter.body||'').trim()}\n\n${atHomeActivity(context)}`}
}
export function fallbackLetter({name,lessons,familyUpdates=[],statements,notes,classNote,vic}){
 const first=String(name||'your child').trim().split(/\s+/)[0]
 const lines=[`Hello,`,`I wanted to share an update about ${first}.`]
 if(lessons.length)lines.push(`In class, we are working on ${lessons.map(l=>l.objectives.join('; ')||l.title).join(' and ')}.`)
 if(familyUpdates.length)lines.push(...familyUpdates.map(update=>update.draft))
 if(vic.length)lines.push(`In VIC, the recorded learning activity included ${vic.map(v=>v.summary).join('; ')}.`)
 if(statements.length)lines.push(`Teacher-selected observations about ${first}: ${statements.join('; ')}.`)
 if(notes)lines.push(notes)
 if(classNote)lines.push(classNote)
 lines.push('Please let me know what you are noticing at home or if you would like to talk.','Thank you for partnering with us.')
 return {subject:`A learning update about ${first}`,body:lines.join('\n\n')}
}
