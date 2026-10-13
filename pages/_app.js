import Head from 'next/head'
import { useEffect } from 'react'
import PasswordGate from '../components/PasswordGate'
import { applyTextSize } from '../lib/text-size'

// AskVic "Midnight Circuit" design system: one set of colors, fonts and text sizes for the whole site.
// Pages keep using the --vic-* tokens; changing them here restyles everything at once.
export default function App({ Component, pageProps }) {
  useEffect(() => { applyTextSize() }, [])
  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600&family=Atkinson+Hyperlegible:wght@400;700&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#0A1330" />
      </Head>
      <PasswordGate><Component {...pageProps} /></PasswordGate>
      <style jsx global>{`
        :root {
          --vic-bg: #F3F6FB;
          --vic-surface: #FFFFFF;
          --vic-surface-muted: #E9EEF7;
          --vic-surface-subtle: #DCE3EF;
          --vic-primary: #2563EB;
          --vic-primary-hover: #1D4FD8;
          --vic-primary-soft: #DCE7FF;
          --vic-success: #047857;
          --vic-success-soft: #D1FAE5;
          --vic-accent: #4E5B78;
          --vic-accent-soft: #EAF1FF;
          --vic-danger: #B42318;
          --vic-danger-soft: #FEE4E2;
          --vic-warning: #0E3892;
          --vic-warning-soft: #D8DEED;
          --vic-text-primary: #0E1730;
          --vic-text-secondary: #4E5B78;
          --vic-text-muted: #64748B;
          --vic-border: #C9D3E6;
          --vic-border-soft: #E2E8F2;
          --vic-field-border: #7D8AA6;
          --vic-disabled: #8A97B5;
          --vic-shadow-soft: 0 10px 24px rgba(10, 19, 48, 0.07);
          --vic-shadow-card: 0 14px 34px rgba(10, 19, 48, 0.10);
          --vic-shadow-raised: 0 24px 56px rgba(10, 19, 48, 0.16);

          /* Frame, signal and accent colors. Each has one job. */
          --vic-ink: #0A1330;
          --vic-ink-2: #16224A;
          --vic-ink-line: #2A3A6E;
          --vic-ink-text: #E8EEFF;
          --vic-ink-muted: #A9B6D8;
          --vic-cyan: #5B76B5;
          --vic-volt: #6A83BC;
          --vic-vic: #5B21B6;
          --vic-vic-glow: #A78BFA;
          --vic-vic-soft: #EDE7FB;

          /* Learning levels: always shown with their name. */
          --lvl-support: #4D69AA; --lvl-support-soft: #E0F2FE; --lvl-support-ink: #075985;
          --lvl-onlevel: #10B981; --lvl-onlevel-soft: #D1FAE5; --lvl-onlevel-ink: #065F46;
          --lvl-enrich: #1759E9; --lvl-enrich-soft: #D8DEED; --lvl-enrich-ink: #0E3892;

          --font-head: 'Space Grotesk', 'Manrope', -apple-system, sans-serif;
          --font-body: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          --font-mono: 'JetBrains Mono', ui-monospace, monospace;
          --font-read: 'Atkinson Hyperlegible', 'Manrope', -apple-system, sans-serif;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: var(--vic-bg);
          color: var(--vic-text-primary);
          font-family: var(--font-body);
          font-size:16px;
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
        }

        /* Text-size setting (A · A · A). Scales whole pages, remembered per person. */
        html[data-text-size='small'] body { zoom: 0.9; }
        html[data-text-size='large'] body { zoom: 1.2; }

        h1, h2, h3, h4 {
          font-family: var(--font-head);
          letter-spacing: -0.02em;
        }

        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }

        a {
          color: var(--vic-primary);
        }

        button,
        input,
        select,
        textarea {
          font: inherit;
        }

        button:focus-visible,
        a:focus-visible,
        input:focus-visible,
        select:focus-visible,
        textarea:focus-visible,
        summary:focus-visible {
          outline: 3px solid var(--vic-cyan);
          outline-offset: 2px;
        }

        ::selection { background: #BFD3FF; }
      `}</style>
    </>
  )
}
