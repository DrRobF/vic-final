// One set of names for the three learning levels, used everywhere a teacher sees them:
// lesson differentiation groups, worksheet versions, printable packets and the VIC roster.
// The saved support_level values stay remediation / core / enrichment.
export const LEVELS=[
 {key:'remediation',name:'Support',plural:'Support',hint:'concrete models, guided practice, and shorter chunks.'},
 {key:'core',name:'On level',plural:'On level',hint:'independent application with feedback.'},
 {key:'enrichment',name:'Enrichment',plural:'Enrichment',hint:'deeper reasoning and transfer to a new situation.'},
]
export const LEVEL_NAME=Object.fromEntries(LEVELS.map(l=>[l.key,l.name]))
export const LEVEL_GROUP_DEFAULTS=[...LEVELS.map(l=>`${l.name}: ${l.hint}`),'Language support: visuals, vocabulary rehearsal, and sentence frames.','Additional group: describe the support or challenge needed.']

// The short name a teacher gave a differentiation group, e.g. "Support" from "Support: concrete models…".
export function groupName(text,index){
 const value=String(text||'').trim()
 const lead=value.split(/[:—–-]/)[0].trim()
 // Older lessons used different wording for the same three levels.
 const legacy={'more support':'Support','working at grade level':'On level','ready for extension':'Enrichment'}[lead.toLowerCase()]
 if(legacy)return legacy
 if(lead&&lead.length<=32&&lead!==value)return lead
 if(value&&value.length<=32)return value
 return `Group ${index+1}`
}
// Which level a worksheet version is for. New worksheets store it; older ones fall back to the lesson's groups.
export function versionLevel(version,index,groups){
 if(version?.level)return version.level
 if(/^Version \d+$/.test(String(version?.label||''))&&Array.isArray(groups)&&groups[index])return groupName(groups[index],index)
 return ''
}
// Teacher-facing label: "Version 1 · Support". Student copies only ever say "Version 1".
export function versionLabel(version,index,groups){
 const base=String(version?.label||`Version ${index+1}`),level=versionLevel(version,index,groups)
 return level&&!base.includes(level)?`${base} · ${level}`:base
}
// One line for teachers: "Version 1 = Support · Version 2 = On level · Version 3 = Enrichment".
export function versionKey(sheet,groups){
 const versions=sheet?.versions||[]
 if(versions.length<2)return ''
 const parts=versions.map((v,i)=>{const level=versionLevel(v,i,groups);return level?`${v.label||`Version ${i+1}`} = ${level}`:''}).filter(Boolean)
 return parts.length?`Which version for which group: ${parts.join(' · ')}`:''
}
