import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  return (
    <>
      <div className="page">
        <main className="hero">
          <div className="badge">Virtual Co-Teacher</div>

          <img
            src="/vic-logo.png"
            alt="VIC Logo"
            className="vicLogo"
          />

          <h2 className="headline">
            Most AI gives answers.
            <br />
            <span>VIC teaches students how to think.</span>
          </h2>

          <p className="subtext">
            A premium AI co-teacher built to guide, check, and adapt like real academic support.
          </p>

          <button className="cta" onClick={() => router.push("/askvic")}>
            Try VIC Now
          </button>

          <p className="ctaSub">No signup. Instant help.</p>

          <div className="demoCard">
            <div className="demoLabel">Example</div>
            <p className="userLine">
              <strong>You:</strong> I don’t get this… why do we flip the fraction?
            </p>
            <p className="vicLine">
              <strong>VIC:</strong> Great question. Dividing by a fraction means multiplying by its reciprocal. So 3/4 ÷ 1/2 becomes 3/4 × 2.
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

        .vicLogo {
          width: min(240px, 55vw);
          height: auto;
          display: block;
          margin: 0 auto 22px;
          filter: drop-shadow(0 0 18px rgba(120, 130, 255, 0.35));
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
          min-width: 230px;
          font-size: 22px;
          font-weight: 800;
          color: white;
          cursor: pointer;
          background: linear-gradient(135deg, #6574ff 0%, #7b61ff 55%, #4c7dff 100%);
          box-shadow: 0 16px 44px rgba(97,113,255,0.38);
        }

        .ctaSub {
          margin-top: 10px;
          font-size: 14px;
          color: rgba(255,255,255,0.58);
        }

        .demoCard {
          margin: 32px auto 0;
          max-width: 640px;
          text-align: left;
          padding: 20px;
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

        .vicLine {
          margin-bottom: 0;
          color: rgba(255,255,255,0.82);
        }

        @media (max-width: 768px) {
          .hero {
            padding: 34px 18px;
          }

          .vicLogo {
            width: min(190px, 62vw);
            margin-bottom: 18px;
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
