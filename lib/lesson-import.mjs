import mammoth from 'mammoth'
import JSZip from 'jszip'
export async function extractLessonFile(name,buffer){
 if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>3*1024*1024)throw new Error('Choose a file smaller than 3 MB.')
 const ext=String(name||'').toLowerCase().split('.').pop()
 let content
 if(['txt','md'].includes(ext))content=buffer.toString('utf8')
 else if(ext==='docx'){
  const zip=await JSZip.loadAsync(buffer)
  const entries=Object.values(zip.files)
  if(entries.length>2000||entries.reduce((sum,f)=>sum+(f._data?.uncompressedSize||0),0)>20*1024*1024)throw new Error('This Word file is too large after extraction. Paste the lesson text instead.')
  content=(await mammoth.extractRawText({buffer})).value
 }else if(ext==='pdf'){
  if(buffer.subarray(0,5).toString()!=='%PDF-')throw new Error('This file is not a readable PDF.')
  const { PDFParse }=await import('pdf-parse')
  const parser=new PDFParse({data:new Uint8Array(buffer)})
  try{const info=await parser.getInfo();if(info.total>30)throw new Error('Import up to 30 PDF pages at a time.');content=(await parser.getText()).text}finally{await parser.destroy()}
 }else throw new Error('Use a Word .docx, readable PDF, TXT, or Markdown file.')
 content=String(content||'').replace(/\0/g,'').trim()
 if(content.length<30)throw new Error('There is not enough readable text. For scanned PDFs, paste the lesson text instead.')
 if(content.length>30000)throw new Error('This lesson exceeds 30,000 characters. Import a smaller lesson or paste the part you want to update.')
 return content
}
