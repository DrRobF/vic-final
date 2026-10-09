import Head from 'next/head'
import VICHeader from './VICHeader'

export const LEGAL_UPDATED='October 9, 2026'
export const CONTACT_EMAIL='drrobfurman@gmail.com'

export default function LegalPage({title,description,summary,children}){
 return <main className="legal"><Head><title>{`${title} | Ask VIC`}</title><meta name="description" content={description}/></Head><VICHeader currentPath=""/>
  <article>
   <p className="eyebrow">ASK VIC</p>
   <h1>{title}</h1>
   <p className="updated">Effective and last updated {LEGAL_UPDATED}</p>
   {summary&&<aside className="summary" aria-label="Plain-language summary">{summary}</aside>}
   {children}
   <nav className="legalNav" aria-label="Legal pages"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Use</a><a href={`mailto:${CONTACT_EMAIL}`}>Contact</a><a href="/">Home</a></nav>
  </article>
  <style jsx>{`.legal{max-width:1100px;margin:auto;padding:24px;color:var(--vic-text-primary)}article{max-width:780px;margin:24px auto 60px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.12em;color:var(--vic-primary);margin:0}h1{font-size:clamp(32px,4vw,44px);letter-spacing:-.03em;margin:8px 0}.updated{color:var(--vic-text-secondary);font-size:14px}.summary{background:var(--vic-surface);border:1px solid var(--vic-border);border-left:5px solid var(--vic-primary);border-radius:12px;padding:18px 22px;margin:22px 0 30px}article :global(h2){font-size:22px;margin:34px 0 10px;letter-spacing:-.01em}article :global(h3){font-size:17px;margin:22px 0 8px}article :global(p),article :global(li){font-size:16px;line-height:1.75}article :global(li){margin:6px 0}article :global(a){color:var(--vic-primary)}article :global(table){width:100%;border-collapse:collapse;margin:12px 0;font-size:14px}article :global(th),article :global(td){border:1px solid var(--vic-border);padding:8px 10px;text-align:left;vertical-align:top;line-height:1.55}article :global(th){background:var(--vic-surface)}.legalNav{display:flex;gap:18px;flex-wrap:wrap;margin-top:44px;padding-top:18px;border-top:1px solid var(--vic-border)}.legalNav a{font-weight:700;font-size:14px}@media(max-width:600px){.legal{padding:16px}article :global(table){display:block;overflow-x:auto}}`}</style>
 </main>
}
