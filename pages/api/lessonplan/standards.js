import catalogue from '../../../data/lesson-standards.json'
export default function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'})}
 const {state,grade,subject}=req.query
 if(!['FL','PA'].includes(state)||!['K','1','2','3','4','5','6','7','8'].includes(grade)||!['reading','math'].includes(subject))return res.status(400).json({error:'Choose Florida or Pennsylvania, K–8, and reading/ELA or math.'})
 res.setHeader('Cache-Control','public, max-age=3600, s-maxage=86400')
 return res.status(200).json({standards:catalogue.filter(r=>r.state===state&&r.grade===grade&&r.subject===subject),checkedAt:'2026-10-04'})
}
