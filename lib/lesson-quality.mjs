// Narrow, deterministic checks supplement teacher review; they do not certify a lesson.
export function calculationWarnings(text){
 const warnings=[]
 const pattern=/(\d+)\s*\/\s*(\d+)\s*(?:=|equals|is equivalent to|simplifies to|reduces to)\s*(\d+)\s*\/\s*(\d+)/gi
 for(const m of String(text||'').matchAll(pattern)){
  const [a,b,c,d]=m.slice(1).map(Number)
  if(!b||!d||!Number.isSafeInteger(a*d)||!Number.isSafeInteger(b*c))continue
  if(a*d!==b*c)warnings.push(`Calculation check: ${m[0]} is not a valid fraction equivalence. Correct this answer before teaching.`)
 }
 return [...new Set(warnings)]
}
export function numericTable(source){
 const rows=String(source||'').split('\n').filter(l=>/^\s*\|/.test(l)).map(l=>l.split('|').slice(1,-1).map(c=>c.trim()))
 if(rows.length<3||rows[0].length!==2)return null
 const data=rows.slice(1).filter(r=>r.length===2&&!/^[- :]+$/.test(r[0]))
 if(data.length<2||data.some(r=>!r[0]||!/^\d+$/.test(r[1])))return null
 return {label:rows[0][1],rows:data.map(([name,n])=>({name,value:Number(n)}))}
}
export function supplyScaledPictograph(source){
 const table=numericTable(source),scale=String(source).match(/(?:each|one)\b[^.\n]{0,100}\b(?:represents?|equals?|stands for)\s+(\d+)/i)
 // Only render a supplied numerical dataset with an explicit scale; never invent data.
 if(!/pictograph/i.test(source)||/[●■★](?:\s*[●■★])+/.test(source)||!table||!scale)return source
 const unit=Number(scale[1]);if(unit<1||table.rows.some(r=>r.value%unit||r.value/unit>60))return source
 return `${source}\n\nScaled pictograph\nKey: each ● represents ${unit} (${table.label}).\n${table.rows.map(r=>`${r.name}: ${r.value?Array(r.value/unit).fill('●').join(' '):'0 symbols'} (${r.value})`).join('\n')}`
}
export function tableFractionWarnings(kit){
 const table=numericTable(kit.sourceMaterial);if(!table)return []
 // Require an explicit population total matching the sum before comparing parts of a whole.
 const total=table.rows.reduce((n,r)=>n+r.value,0)
 if(!new RegExp(`\\b(?:survey of|total of|out of)\\s+${total}\\b`,'i').test(kit.sourceMaterial))return []
 const fractionWords={'one-half':[1,2],'one-third':[1,3],'one-fourth':[1,4],'one-quarter':[1,4],'one-fifth':[1,5],'one-tenth':[1,10]}
 const warnings=[]
 for(const q of [...(kit.discussionGuide?.questions||[]),...(kit.assessment?.items||[])]){
  const question=q.question||q.prompt||'',answer=q.sampleResponse||''
  const rows=table.rows.filter(r=>question.toLowerCase().includes(r.name.toLowerCase()))
  if(rows.length!==1)continue
  for(const [word,[n,d]] of Object.entries(fractionWords))if(new RegExp(`\\b${word.replace('-','[- ]')} of (?:the|this|our|all)\\b`,'i').test(answer)&&rows[0].value*d!==total*n)warnings.push(`Calculation check: the answer about ${rows[0].name} says ${word}, but the supplied data gives ${rows[0].value}/${total}. Correct the part-of-whole claim before teaching.`)
 }
 return warnings
}
export function resourceWarnings(kit){
 const source=kit.sourceMaterial||'',warnings=[]
 const all=Object.values(kit).filter(v=>typeof v==='string').join('\n')
 if(/scaled pictograph/i.test(all)&&!/[●■★]/.test(source)&&!/(?:pictograph[\s\S]{0,150}(?:\*{2,}|\[.*\].*\[.*\]))/i.test(source))warnings.push('Materials check: a scaled pictograph is referenced. Confirm the actual chart is included, not just its description.')
 const support=typeof kit.supports==='string'?kit.supports:''
 if(/(?:additional|different|new)\s+(?:survey\s+)?data(?:\s+set)?/i.test(support)&&!numericTable(support)&&!/(?:\b\d+\s*[,;:]\s*\d+\b|\b\w+\s*:\s*\d+)/.test(support))warnings.push('Materials check: the extension references another dataset without supplying its values. Add the dataset before using that extension.')
 return warnings
}
const gcd=(a,b)=>b?gcd(b,a%b):a
export function prepareTeachingKit(original){
 const kit=structuredClone(original),notes=[]
 const table=numericTable(kit.sourceMaterial),total=table?.rows.reduce((n,r)=>n+r.value,0)
 const knownPopulation=total&&new RegExp(`\\b(?:survey of|total of|out of)\\s+${total}\\b`,'i').test(kit.sourceMaterial)
 const words={'one-half':[1,2],'one-third':[1,3],'one-fourth':[1,4],'one-quarter':[1,4],'one-fifth':[1,5],'one-tenth':[1,10]}
 for(const q of [...(kit.discussionGuide?.questions||[]),...(kit.assessment?.items||[])]){
  if(q.responseType!=='calculation'||/\b(?:incorrect|wrong|false|misconception|not equivalent)\b/i.test(q.sampleResponse||''))continue
  let answer=q.sampleResponse
  answer=answer.replace(/(\d+)\s*\/\s*(\d+)\s*(=|equals|is equivalent to|simplifies to|reduces to)\s*(\d+)\s*\/\s*(\d+)/gi,(match,a,b,op,c,d)=>{
   const [n,den,r,s]=[a,b,c,d].map(Number)
   if(!den||!s||!Number.isSafeInteger(n*s)||!Number.isSafeInteger(den*r)||n*s===den*r)return match
   const divisor=gcd(n,den)
   notes.push(`Accuracy check: corrected the fraction equivalence ${match} using the supplied numerator and denominator.`)
   return `${a}/${b} ${op} ${n/divisor}/${den/divisor}`
  })
  const rows=knownPopulation?table.rows.filter(r=>(q.question||q.prompt||'').toLowerCase().includes(r.name.toLowerCase())):[]
  if(rows.length===1){
   const row=rows[0],divisor=gcd(row.value,total)
   for(const [word,[n,d]] of Object.entries(words)){
    const pattern=new RegExp(`\\b${word.replace('-','[- ]')}(?= of (?:the|this|our|all)\\b)`,'gi')
    if(row.value*d!==total*n&&pattern.test(answer)){
     answer=answer.replace(pattern,`${row.value/divisor}/${total/divisor}`)
     notes.push(`Accuracy check: corrected the part-of-whole answer for ${row.name} to ${row.value}/${total} (${row.value/divisor}/${total/divisor}).`)
    }
   }
  }
  q.sampleResponse=answer
 }
 return {kit,notes:[...new Set(notes)]}
}
