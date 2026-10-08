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
 const statements=Array.isArray(raw?.statements)?[...new Set(raw.statements)]:[]
 const notes=typeof raw?.notes==='string'?raw.notes.trim():''
 const classNote=typeof raw?.classNote==='string'?raw.classNote.trim():''
 if(lessonIds.length>5||lessonIds.some(id=>typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)))throw new Error('Choose up to five saved lessons.')
 if(statements.length>6||statements.some(id=>!Object.hasOwn(LETTER_STATEMENTS,id)))throw new Error('Choose up to six suggested statements.')
 if(notes.length>1500||classNote.length>1500)throw new Error('Keep each note under 1,500 characters.')
 if(!includeVic&&!includeVicReport&&!lessonIds.length&&!statements.length&&!notes&&!classNote)throw new Error('Choose at least one source for this letter.')
 return {includeVic,includeVicReport,lessonIds,statements,notes,classNote}
}
export function validParentEmail(value){return typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}
export function fallbackLetter({name,lessons,statements,notes,classNote,vic}){
 const first=String(name||'your child').trim().split(/\s+/)[0]
 const lines=[`Hello,`,`I wanted to share an update about ${first}.`]
 if(lessons.length)lines.push(`In class, we are working on ${lessons.map(l=>l.objectives.join('; ')||l.title).join(' and ')}.`)
 if(vic.length)lines.push(`In VIC, the recorded learning activity included ${vic.map(v=>v.summary).join('; ')}.`)
 if(statements.length)lines.push(`Teacher-selected observations about ${first}: ${statements.join('; ')}.`)
 if(notes)lines.push(notes)
 if(classNote)lines.push(classNote)
 lines.push('Please let me know what you are noticing at home or if you would like to talk.','Thank you for partnering with us.')
 return {subject:`A learning update about ${first}`,body:lines.join('\n\n')}
}
