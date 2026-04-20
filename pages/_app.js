export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <style jsx global>{`
        :root {
          --vic-bg: #f8fafc;
          --vic-surface: #ffffff;
          --vic-surface-muted: #f1f5f9;
          --vic-surface-subtle: #e2e8f0;
          --vic-primary: #2563eb;
          --vic-primary-hover: #1d4ed8;
          --vic-primary-soft: #dbeafe;
          --vic-success: #15803d;
          --vic-success-soft: #dcfce7;
          --vic-accent: #d97706;
          --vic-accent-soft: #fef3c7;
          --vic-danger: #dc2626;
          --vic-danger-soft: #fee2e2;
          --vic-text-primary: #0f172a;
          --vic-text-secondary: #334155;
          --vic-text-muted: #475569;
          --vic-border: #cbd5e1;
          --vic-border-soft: #e2e8f0;
          --vic-disabled: #94a3b8;
          --vic-shadow-soft: 0 6px 16px rgba(15, 23, 42, 0.06);
          --vic-shadow-card: 0 10px 28px rgba(15, 23, 42, 0.08);
          --vic-shadow-raised: 0 16px 36px rgba(15, 23, 42, 0.1);
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #ffffff;
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
        textarea:focus-visible {
          outline: 2px solid var(--vic-primary);
          outline-offset: 2px;
        }
      `}</style>
    </>
  )
}
