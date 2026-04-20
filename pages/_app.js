export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <style jsx global>{`
        :root {
          --vic-bg: #F7F2EA;
          --vic-surface: #FFFDFC;
          --vic-surface-muted: #EFE7DC;
          --vic-surface-subtle: #E5D7C9;
          --vic-primary: #B5532F;
          --vic-primary-hover: #964528;
          --vic-primary-soft: #E8D8C8;
          --vic-success: #5E7C5A;
          --vic-success-soft: #DCE6D8;
          --vic-accent: #7B8163;
          --vic-accent-soft: #ECE9DB;
          --vic-danger: #A14D3A;
          --vic-danger-soft: #E9D4CD;
          --vic-text-primary: #2B241F;
          --vic-text-secondary: #5E544C;
          --vic-text-muted: #5E544C;
          --vic-border: #D9CBBE;
          --vic-border-soft: #E7DCCF;
          --vic-disabled: #A18E80;
          --vic-shadow-soft: 0 10px 24px rgba(43, 36, 31, 0.08);
          --vic-shadow-card: 0 14px 36px rgba(43, 36, 31, 0.12);
          --vic-shadow-raised: 0 24px 56px rgba(43, 36, 31, 0.14);
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
