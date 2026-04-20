export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <style jsx global>{`
        :root {
          --vic-bg: #e7edf5;
          --vic-surface: #ffffff;
          --vic-surface-muted: #edf3fb;
          --vic-surface-subtle: #dfe8f5;
          --vic-primary: #1d4ed8;
          --vic-primary-hover: #1e40af;
          --vic-primary-soft: #cfe0ff;
          --vic-success: #15803d;
          --vic-success-soft: #dcfce7;
          --vic-accent: #d97706;
          --vic-accent-soft: #fef3c7;
          --vic-danger: #dc2626;
          --vic-danger-soft: #fee2e2;
          --vic-text-primary: #0f172a;
          --vic-text-secondary: #1e293b;
          --vic-text-muted: #475569;
          --vic-border: #b6c4d8;
          --vic-border-soft: #c8d4e5;
          --vic-disabled: #94a3b8;
          --vic-shadow-soft: 0 8px 20px rgba(15, 23, 42, 0.08);
          --vic-shadow-card: 0 14px 30px rgba(15, 23, 42, 0.12);
          --vic-shadow-raised: 0 20px 44px rgba(15, 23, 42, 0.16);
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
