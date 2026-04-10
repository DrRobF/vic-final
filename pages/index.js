import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  return (
    <>
      <div className="page">
        <main className="hero">
          <div className="badge">Virtual Co-Teacher</div>

          <div className="logoWrap">
            <div className="logoGlow"></div>
            <img src="/vic-logo.png" alt="VIC Logo" className="vicLogo" />
          </div>

          <h2 className="headline">
            If AI just gives you answers…
            <br />
            <span>you’re not actually learning.</span>
          </h2>

          <p className="subtext">
            VIC works differently. It guides you, checks your thinking, and helps you understand step-by-step — like a real teacher sitting next to you.
          </p>

          <button className="cta" onClick={() => router.push("/askvic")}>
            Try VIC — See How It Teaches
          </button>

          <p className="ctaSub">Takes 10 seconds. No signup.</p>

          <div className="demoCard">
            <div className="demoLabel">What it feels like</div>

            <p className="userLine">
              <strong>You:</strong> I don’t get this… why do we flip the fraction?
            </p>

            <p className="vicLine">
              <strong>VIC:</strong> Good question. Before we flip it—what does dividing actually mean here?
            </p>

            <p className="vicLine">
              <strong>VIC:</strong> If you’re dividing by 1/2, you’re really asking: how many halves fit into something.
            </p>

            <p className="vicLine highlight">
              <strong>VIC:</strong> That’s why we multiply by 2. You’re counting how many halves there are.
            </p>
          </div>
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
          font-family: Inter, Arial, sans-serif;
          background: #050505;
          color: white;
        }

        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(72, 103, 255, 0.18), transparent 30%),
            radial-gradient(circle at bottom right, rgba(123, 73, 255, 0.14), transparent 28%),
            linear-gradient(180deg, #050505 0%, #0a0a0f 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .hero {
          width: 100%;
          max-width: 900px;
          text-align: center;
          padding: 48px 28px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 28px;
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(10px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.45);
        }

        .badge {
          display: inline-block;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.8);
          margin-bottom: 22px;
        }

        .logoWrap {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 0 auto 22px;
          width: 100%;
          min-height: 220px;
        }

        .logoGlow {
          position: absolute;
          width: 360px;
          height: 360px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(120, 130, 255, 0.26) 0%,
            rgba(120, 130, 255, 0.14) 35%,
            rgba(120, 130, 255, 0.06) 52%,
            transparent 72%
          );
          filter: blur(42px);
          z-index: 0;
        }

        .vicLogo {
          width: min(320px, 70vw);
          height: auto;
          position: relative;
          z-index: 1;
          filter: drop-shadow(0 0 28px rgba(120, 130, 255, 0.45));
        }

        .headline {
          margin: 0;
          font-size: clamp(34px, 5vw, 62px);
          line-height: 1.02;
          font-weight: 800;
          letter-spacing: -0.05em;
        }

        .headline span {
          color: #9fb0ff;
        }

        .subtext {
          max-width: 680px;
          margin: 20px auto 0;
          font-size: 18px;
          line-height: 1.6;
          color: rgba(255,255,255,0.72);
        }

        .cta {
          margin-top: 30px;
          border: none;
          border-radius: 18px;
          padding: 18px 34px;
          min-width: 260px;
          font-size: 22px;
          font-weight: 800;
          color: white;
          cursor: pointer;
          background: linear-gradient(135deg, #6574ff 0%, #7b61ff 55%, #4c7dff 100%);
          box-shadow: 0 16px 44px rgba(97,113,255,0.38);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 22px 60px rgba(97,113,255,0.5);
        }

        .ctaSub {
          margin-top: 10px;
          font-size: 14px;
          color: rgba(255,255,255,0.58);
        }

        .demoCard {
          margin: 36px auto 0;
          max-width: 640px;
          text-align: left;
          padding: 22px;
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.05);
        }

        .demoLabel {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: rgba(190,198,255,0.78);
          margin-bottom: 14px;
        }

        .userLine,
        .vicLine {
          margin: 0 0 12px;
          font-size: 16px;
          line-height: 1.6;
          color: rgba(255,255,255,0.9);
        }

        .highlight {
          color: #c6d0ff;
        }

        @media (max-width: 768px) {
          .hero {
            padding: 34px 18px;
          }

          .vicLogo {
            width: min(220px, 68vw);
          }

          .subtext {
            font-size: 16px;
          }

          .cta {
            width: 100%;
            max-width: 320px;
            font-size: 20px;
          }

          .userLine,
          .vicLine {
            font-size: 15px;
          }
        }
      `}</style>
    </>
  );
}
