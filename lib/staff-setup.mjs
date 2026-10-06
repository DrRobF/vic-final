export function staffRows(input,adminEmail){
 if(!Array.isArray(input)||!input.length||input.length>100)throw new Error('Provide 1–100 staff members.')
 const seen=new Set()
 return input.map(row=>{
  const name=typeof row?.name==='string'?row.name.trim().replace(/\s+/g,' '):''
  const email=typeof row?.email==='string'?row.email.trim().toLowerCase():''
  if(!name||name.length>150)throw new Error('Every staff member needs a name of 1–150 characters.')
  if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Every staff member needs a valid email.')
  if(email===adminEmail.toLowerCase())throw new Error('Your administrator account cannot be changed by staff setup.')
  if(seen.has(email))throw new Error('A staff email appears more than once.')
  if(row.role!==undefined&&row.role!=='teacher')throw new Error('This setup grants teacher tools only. Administrator rights cannot be added.')
  seen.add(email);return {name,email,role:'teacher'}
 })
}
