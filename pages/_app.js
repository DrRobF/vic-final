export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <style jsx global>{`
        :root {
          --vic-bg: #F7FAFC;
          --vic-surface: #FFFFFF;
          --vic-surface-muted: #EEF4F8;
          --vic-primary: #2563EB;
          --vic-primary-hover: #1D4ED8;
          --vic-primary-soft: #DBEAFE;
          --vic-success: #16A34A;
          --vic-success-soft: #DCFCE7;
          --vic-accent: #F59E0B;
          --vic-accent-soft: #FEF3C7;
          --vic-danger: #DC2626;
          --vic-danger-soft: #FEE2E2;
          --vic-text-primary: #0F172A;
          --vic-text-secondary: #475569;
          --vic-border: #CBD5E1;
          --vic-disabled: #94A3B8;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: var(--vic-bg);
          color: var(--vic-text-primary);
          font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }

        a {
          color: var(--vic-primary);
        }

        button:focus-visible,
        a:focus-visible,
        input:focus-visible,
        select:focus-visible,
        textarea:focus-visible {
          outline: 2px solid var(--vic-primary);
          outline-offset: 2px;
        }
      `}</style>
    </>
  )
}
