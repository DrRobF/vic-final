import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  return (
    <>
      <div className="page">
        <div className="bg-grid" />
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <div className="noise" />

        <main className="hero">
          <div className="badge">Virtual Co-Teacher</div>

          <div className="logoWrap">
            <div className="logoHalo" />
            <h1 className="logo">VIC</h1>
          </div>

          <div className="heroCard">
            <p className="eyebrow">The next evolution of learning support</p>

            <h2 className="headline">
              Most AI gives answers.
              <br />
              <span>VIC teaches students how to think.</span>
            </h2>

            <p className="subtext">
              A premium AI co-teacher designed to guide, check, and adapt like
              real academic support.
            </p>

            <div className="ctaRow">
              <button
                className="cta"
                onClick={() => router.push("/askvic")}
              >
                Talk to VIC
              </button>
            </div>

            <div className="microFeatures">
              <span>Guides step-by-step</span>
              <span>Checks understanding</span>
              <span>Adapts to the learner</span>
            </div>
          </div>

          <p className="bottomLine">
            Built for students, parents, and teachers
          </p>
        </main>
      </div>

      <style jsx global>{`
        html,
        body,
        #__next {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100%;
          background: #030303;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        .page {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          background:
            radial-gradient(circle at 20% 20%, rgba(74, 99, 255, 0.15), transparent 28%),
            radial-gradient(circle at 80% 30%, rgba(120, 75, 255, 0.14), transparent 24%),
            radial-gradient(circle at 50% 80%, rgba(0, 209, 255, 0.08), transparent 30%),
            linear-gradient(180deg, #050505 0%, #090909 45%, #040404 100%);
          color: white;
        }

        .bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(circle at center, black 35%, transparent 85%);
          opacity: 0.28;
          pointer-events: none;
        }

        .noise {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(255,255,255,0.03) 0.6px, transparent 0.6px);
          background-size: 10px 10px;
          opacity: 0.18;
          mix-blend-mode: soft-light;
          pointer-events: none;
        }

        .glow {
          position: absolute;
          border-radius: 999px;
          filter: blur(90px);
          opacity: 0.55;
          animation: floatGlow 10s ease-in-out infinite;
          pointer-events: none;
        }

        .glow-1 {
          width: 380px;
          height: 380px;
          top: 10%;
          left: 12%;
          background: rgba(91, 110, 255, 0.32);
        }

        .glow-2 {
          width: 320px;
          height: 320px;
          right: 10%;
          bottom: 12%;
          background: rgba(108, 76, 255, 0.25);
          animation-delay: 1.5s;
        }

        .hero {
          position: relative;
          z-index: 2;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 20px;
          text-align: center;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(16px);
          color: rgba(255, 255, 255, 0.82);
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin-bottom: 28px;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.02) inset;
        }

        .logoWrap {
          position: relative;
          margin-bottom: 28px;
        }

        .logoHalo {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 220px;
          height: 220px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: radial-gradient(circle, rgba(97, 113, 255, 0.24) 0%, rgba(97, 113, 255, 0.06) 45%, transparent 72%);
          filter: blur(18px);
          pointer-events: none;
        }

        .logo {
          position: relative;
          margin: 0;
          font-size: clamp(76px, 12vw, 150px);
          font-weight: 800;
          line-height: 0.95;
          letter-spacing: -0.06em;
          color: #ffffff;
          text-shadow:
            0 0 22px rgba(122, 132, 255, 0.22),
            0 0 50px rgba(122, 132, 255, 0.12);
        }

        .heroCard {
          width: 100%;
          max-width: 920px;
          padding: 34px 28px 28px;
          border-radius: 28px;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.08) 0%,
            rgba(255, 255, 255, 0.04) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.10);
          backdrop-filter: blur(22px);
          box-shadow:
            0 20px 80px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .eyebrow {
          margin: 0 0 14px;
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(180, 188, 255, 0.78);
        }

        .headline {
          margin: 0;
          font-size: clamp(34px, 5.5vw, 68px);
          line-height: 1.02;
          font-weight: 800;
          letter-spacing: -0.045em;
          color: #ffffff;
        }

        .headline span {
          display: inline-block;
          background: linear-gradient(90deg, #ffffff 0%, #c7d0ff 45%, #8da0ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
                  background-clip: text;
        }

        .subtext {
          max-width: 720px;
          margin: 20px auto 0;
          font-size: clamp(17px, 2vw, 21px);
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.74);
        }

        .ctaRow {
          display: flex;
          justify-content: center;
          margin-top: 32px;
        }

        .cta {
          appearance: none;
          border: none;
          cursor: pointer;
          padding: 18px 34px;
          min-width: 220px;
          border-radius: 16px;
          font-size: 20px;
          font-weight: 700;
          color: white;
          background: linear-gradient(135deg, #6574ff 0%, #7b61ff 55%, #4c7dff 100%);
          box-shadow:
            0 14px 40px rgba(97, 113, 255, 0.35),
            0 0 28px rgba(97, 113, 255, 0.22);
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }

        .cta:hover {
          transform: translateY(-2px) scale(1.01);
          box-shadow:
            0 18px 50px rgba(97, 113, 255, 0.45),
            0 0 34px rgba(97, 113, 255, 0.28);
          filter: brightness(1.05);
        }

        .cta:active {
          transform: translateY(0);
        }

        .microFeatures {
          margin-top: 26px;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
        }

        .microFeatures span {
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.82);
          font-size: 14px;
          backdrop-filter: blur(10px);
        }

        .bottomLine {
          margin-top: 22px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.46);
          letter-spacing: 0.02em;
        }

        @keyframes floatGlow {
          0%,
          100% {
            transform: translateY(0px) translateX(0px) scale(1);
          }
          50% {
            transform: translateY(-18px) translateX(10px) scale(1.04);
          }
        }

        @media (max-width: 768px) {
          .hero {
            padding: 34px 16px;
          }

          .heroCard {
            padding: 26px 18px 22px;
            border-radius: 22px;
          }

          .cta {
            width: 100%;
            max-width: 320px;
            font-size: 18px;
          }

          .microFeatures {
            gap: 8px;
          }

          .microFeatures span {
            font-size: 13px;
            padding: 9px 12px;
          }
        }
      `}</style>
    </>
  );
}
