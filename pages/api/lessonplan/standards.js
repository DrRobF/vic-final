import catalogue from '../../../data/lesson-standards.json'
import {hasCatalogue,PLANNER_SUBJECTS} from '../../../lib/lesson-subjects.mjs'
export default function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'})}
 const {state,grade,subject}=req.query
 // Validated against what the catalogue actually holds, so a subject becomes
 // selectable the moment its official standards are imported -- and not before.
 if(!PLANNER_SUBJECTS.includes(subject)||!hasCatalogue(state,grade,subject))return res.status(400).json({error:'No official standards are loaded for that state, grade and subject yet. Paste your standard instead.'})
 res.setHeader('Cache-Control','public, max-age=3600, s-maxage=86400')
 return res.status(200).json({standards:catalogue.filter(r=>r.state===state&&r.grade===grade&&r.subject===subject),checkedAt:'2026-10-04'})
}
