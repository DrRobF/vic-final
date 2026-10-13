import Head from 'next/head'
import VICHeader from './VICHeader'

// Standard page frame for the redesigned screens: top bar, centered content, consistent spacing.
export default function PageShell({ title, description, currentPath, width = 1240, children }) {
 return <div className="shell">
  <Head><title>{title ? `${title} | AskVic` : 'AskVic'}</title>{description && <meta name="description" content={description} />}</Head>
  <VICHeader currentPath={currentPath} />
  <main>{children}</main>
  <style jsx>{`
   .shell{max-width:${width}px;margin:0 auto;padding:16px 24px 56px}
   main{display:flex;flex-direction:column;gap:20px}
   @media(max-width:700px){.shell{padding:10px 14px 40px}}
  `}</style>
 </div>
}

// Shared look for cards, buttons and notices on the redesigned screens.
export function PanelStyles() {
 return <style jsx global>{`
  .panel{background:var(--vic-surface);border:1px solid var(--vic-border-soft);border-radius:16px;padding:22px;box-shadow:var(--vic-shadow-soft)}
  .panel h2{margin:0 0 6px;font-size:22px}
  .panel p{margin:0;color:var(--vic-text-secondary);line-height:1.6}
  .dark-panel{background:var(--vic-ink);color:var(--vic-ink-text);border-radius:16px;padding:22px;box-shadow:0 0 0 1px var(--vic-ink-line)}
  .dark-panel p{color:var(--vic-ink-muted)}
  .label{font-family:var(--font-mono);font-size:13px;letter-spacing:.02em;color:var(--vic-primary);text-transform:uppercase;margin:0 0 6px}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:11px 18px;border-radius:12px;font-weight:800;font-size:16px;text-decoration:none;cursor:pointer;border:1px solid transparent;font-family:var(--font-body)}
  .btn-primary{background:var(--vic-primary);color:#fff;box-shadow:0 10px 22px rgba(37,99,235,.28)}
  .btn-primary:hover{background:var(--vic-primary-hover)}
  .btn-outline{background:var(--vic-surface);color:var(--vic-text-primary);border-color:var(--vic-border)}
  .btn-outline:hover{background:var(--vic-surface-muted)}
  .btn-volt{background:var(--vic-volt);color:var(--vic-ink)}
  .btn-cyan{background:var(--vic-cyan);color:#06202A}
  .btn:disabled{opacity:.55;cursor:not-allowed}
  .notice{padding:12px 16px;border-radius:12px;background:var(--vic-success-soft);color:var(--vic-success);font-weight:700}
  .alert{padding:12px 16px;border-radius:12px;background:var(--vic-danger-soft);color:#912018;font-weight:700}
  .muted{color:var(--vic-text-secondary)}
  .level{display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:999px;font-size:14px;font-weight:800}
  .level::before{content:'';width:9px;height:9px;border-radius:50%}
  .level.support{background:var(--lvl-support-soft);color:var(--lvl-support-ink)}.level.support::before{background:var(--lvl-support)}
  .level.onlevel{background:var(--lvl-onlevel-soft);color:var(--lvl-onlevel-ink)}.level.onlevel::before{background:var(--lvl-onlevel)}
  .level.enrich{background:var(--lvl-enrich-soft);color:var(--lvl-enrich-ink)}.level.enrich::before{background:var(--lvl-enrich)}
 `}</style>
}
