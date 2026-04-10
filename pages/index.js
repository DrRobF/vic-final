import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  return (
    <>
      <div className="page">
        <div className="ambient ambientOne"></div>
        <div className="ambient ambientTwo"></div>
        <div className="gridFade"></div>

        <main className="shell">
          <section className="hero">
            <div className="heroTop">
              <div className="badge">Virtual Co-Teacher</div>
            </div>

            <div className="heroGrid">
              <div className="heroCopy">
                <div className="eyebrow">Not another answer machine</div>

                <h1 className="headline">
                  This doesn’t just answer questions.
                  <span> It teaches students how to think.</span>
                </h1>

                <p className="subtext">
                  VIC guides step-by-step, checks student thinking, gives hints
                  instead of shortcuts, and helps learning actually stick — like
                  a real teacher sitting beside them.
                </p>

                <div className="ctaRow">
                  <button
                    className="cta"
                    onClick={() => router.push("/askvic")}
                  >
                    Step Into VIC
                  </button>

                  <div className="ctaMeta">
                    <div className="metaStrong">Try the teaching experience</div>
                    <div className="metaSoft">No signup. Takes about 10 seconds.</div>
                  </div>
                </div>

                <div className="proofRow">
                  <div className="proofPill">Guides step-by-step</div>
                  <div className="proofPill">Checks thinking</div>
                  <div className="proofPill">Hints, not shortcuts</div>
                </div>
              </div>

              <div className="heroVisual">
                <div className="logoStage">
                  <div className="logoHalo"></div>
                  <div className="logoRing"></div>
                  <img src="/vic-logo.png" alt="VIC Logo" className="vicLogo" />
                </div>

                <div className="floatingCard floatingPrompt">
                  <span className="floatingLabel">Student moment</span>
                  “Wait… why do we flip the fraction?”
                </div>

                <div className="floatingCard floatingResponse">
                  <span className="floatingLabel">VIC response</span>
                  “Before we flip it, what does dividing mean here?”
                </div>
              </div>
            </div>
          </section>

          <section className="transitionBand">
            <p className="transitionText">
              Most AI tools rush to the answer.
            </p>
            <p className="transitionText dim">
              VIC slows down, reads the student, and teaches through the moment.
            </p>
          </section>

          <section className="revealSection">
            <div className="sectionIntro">
              <div className="sectionKicker">The reveal</div>
              <h2 className="sectionTitle">What a live teaching moment feels like</h2>
              <p className="sectionCopy">
                This is the difference. VIC does not just display information —
                it responds like a teacher who is watching how a student is thinking.
              </p>
            </div>

            <div className="demoWrap">
              <div className="demoGlow"></div>

              <div className="demoCard">
                <div className="demoHeader">
                  <div>
                    <div className="demoEyebrow">Live teaching moment</div>
                    <div className="demoTitle">Fraction division</div>
                  </div>

                  <div className="demoStatus">
                    <span className="statusDot"></span>
                    Teaching live
                  </div>
                </div>

                <div className="chatFlow">
                  <div className="msg student">
                    <div className="msgLabel">Student</div>
                    <p>I don’t get this… why do we flip the fraction?</p>
                  </div>

                  <div className="msg vic">
                    <div className="msgLabel">VIC</div>
                    <p>
                      Good question. Before we flip it, let’s slow down.
                      What does dividing mean here?
                    </p>
                  </div>

                  <div className="msg vic">
                    <div className="msgLabel">VIC</div>
                    <p>
                      If you’re dividing by <strong>1/2</strong>, you’re really
                      asking: <em>how many halves fit into something?</em>
                    </p>
                  </div>

                  <div className="msg highlight">
                    <div className="msgLabel">VIC</div>
                    <p>
                      That’s why multiplying by 2 works — you’re counting how
                      many halves there are.
                    </p>
                  </div>
                </div>

                <div className="demoFooter">
                  <div className="footerItem">Responds to confusion</div>
                  <div className="footerItem">Builds understanding</div>
                  <div className="footerItem">Teaches, not just solves</div>
                </div>
              </div>
            </div>
          </section>

          <section className="compareSection">
            <div className="compareCard muted">
              <div className="compareLabel">Typical AI</div>
              <h3>Fast answers</h3>
              <ul>
                <li>Jumps to the solution</li>
                <li>Doesn’t check student thinking</li>
                <li>Can make learning feel shallow</li>
              </ul>
            </div>

            <div className="compareCard featured">
              <div className="compareLabel">VIC</div>
              <h3>Real teaching behavior</h3>
              <ul>
                <li>Guides step-by-step</li>
                <li>Adapts to the student</li>
                <li>Turns confusion into understanding</li>
              </ul>
            </div>
          </section>

          <section className="finalCta">
            <div className="finalCard">
              <div className="sectionKicker">Try it now</div>
              <h2 className="finalTitle">Step into a tutoring experience that actually teaches</h2>
              <p className="finalCopy">
                Not shortcuts. Not generic AI chatter. A real teaching moment,
                built to help students think, understand, and grow.
              </p>

              <button
                className="cta large"
                onClick={() => router.push("/askvic")}
              >
                Start a Session with VIC
              </button>
            </div>
          </section>
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

        body {
          overflow-x: hidden;
          background:
            radial-gradient(circle at top, rgba(76, 100, 255, 0.12), transparent 22%),
            linear-gradient(180deg, #050505 0%, #090910 45%, #050505 100%);
        }

        .page {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
        }

        .ambient {
          position: absolute;
          border-radius: 999px;
          filter: blur(80px);
          pointer-events: none;
          opacity: 0.8;
        }

        .ambientOne {
          width: 420px;
          height: 420px;
          top: 80px;
          left: -80px;
          background: rgba(88, 110, 255, 0.16);
        }

        .ambientTwo {
          width: 380px;
          height: 380px;
          top: 440px;
          right: -100px;
          background: rgba(123, 73, 255, 0.14);
        }

        .gridFade {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: linear-gradient(180deg, rgba(255,255,255,0.22), transparent 70%);
          pointer-events: none;
        }

        .shell {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1220px;
          margin: 0 auto;
          padding: 32px 20px 80px;
        }

        .hero {
          position: relative;
          padding: 26px 0 24px;
        }

        .heroTop {
          display: flex;
          justify-content: center;
          margin-bottom: 26px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.78);
          backdrop-filter: blur(10px);
        }

        .heroGrid {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 40px;
          align-items: center;
        }

        .heroCopy {
          position: relative;
          padding: 24px 6px 24px 0;
        }

        .eyebrow {
          font-size: 13px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #9fb0ff;
          margin-bottom: 18px;
        }

        .headline {
          margin: 0;
          font-size: clamp(42px, 6vw, 78px);
          line-height: 0.96;
          font-weight: 800;
          letter-spacing: -0.06em;
          max-width: 720px;
        }

        .headline span {
          display: block;
          color: rgba(255,255,255,0.82);
        }

        .subtext {
          max-width: 650px;
          margin: 22px 0 0;
          font-size: 19px;
          line-height: 1.7;
          color: rgba(255,255,255,0.72);
        }

        .ctaRow {
          display: flex;
          align-items: center;
          gap: 18px;
          margin-top: 30px;
          flex-wrap: wrap;
        }

        .cta {
          border: none;
          border-radius: 18px;
          padding: 18px 30px;
          min-width: 220px;
          font-size: 20px;
          font-weight: 800;
          color: white;
          cursor: pointer;
          background: linear-gradient(135deg, #6574ff 0%, #7b61ff 58%, #4c7dff 100%);
          box-shadow: 0 18px 50px rgba(97,113,255,0.34);
          transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
        }

        .cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 24px 64px rgba(97,113,255,0.48);
        }

        .cta.large {
          margin-top: 10px;
          min-width: 280px;
          font-size: 22px;
          padding: 20px 34px;
        }

        .ctaMeta {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .metaStrong {
          font-size: 15px;
          font-weight: 700;
          color: rgba(255,255,255,0.92);
        }

        .metaSoft {
          font-size: 14px;
          color: rgba(255,255,255,0.58);
        }

        .proofRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 28px;
        }

        .proofPill {
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.8);
          font-size: 14px;
        }

        .heroVisual {
          position: relative;
          min-height: 620px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logoStage {
          position: relative;
          width: 100%;
          max-width: 520px;
          height: 520px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logoHalo {
          position: absolute;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(120, 130, 255, 0.28) 0%,
            rgba(120, 130, 255, 0.14) 36%,
            rgba(120, 130, 255, 0.05) 58%,
            transparent 74%
          );
          filter: blur(34px);
        }

        .logoRing {
          position: absolute;
          width: 320px;
          height: 320px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 0 0 26px rgba(255,255,255,0.015),
            0 0 0 56px rgba(255,255,255,0.01);
        }

        .vicLogo {
          width: min(360px, 72vw);
          height: auto;
          position: relative;
          z-index: 2;
          filter: drop-shadow(0 0 34px rgba(120, 130, 255, 0.34));
        }

        .floatingCard {
          position: absolute;
          z-index: 3;
          max-width: 240px;
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(10, 10, 20, 0.78);
          backdrop-filter: blur(12px);
          box-shadow: 0 16px 40px rgba(0,0,0,0.34);
          color: rgba(255,255,255,0.88);
          font-size: 14px;
          line-height: 1.5;
        }

        .floatingPrompt {
          top: 82px;
          right: 8px;
          transform: rotate(3deg);
        }

        .floatingResponse {
          bottom: 74px;
          left: 0;
          transform: rotate(-4deg);
        }

        .floatingLabel {
          display: block;
          margin-bottom: 6px;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #aeb9ff;
        }

        .transitionBand {
          margin-top: 8px;
          padding: 34px 0 12px;
          text-align: center;
        }

        .transitionText {
          margin: 0;
          font-size: clamp(24px, 3vw, 38px);
          font-weight: 700;
          letter-spacing: -0.04em;
          color: rgba(255,255,255,0.94);
        }

        .transitionText.dim {
          margin-top: 10px;
          color: rgba(255,255,255,0.5);
        }

        .revealSection {
          margin-top: 46px;
        }

        .sectionIntro {
          max-width: 760px;
          margin: 0 0 24px 0;
        }

        .sectionKicker {
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #9fb0ff;
          margin-bottom: 10px;
        }

        .sectionTitle {
          margin: 0;
          font-size: clamp(32px, 4vw, 54px);
          line-height: 1.02;
          font-weight: 800;
          letter-spacing: -0.05em;
        }

        .sectionCopy {
          margin: 16px 0 0;
          font-size: 18px;
          line-height: 1.7;
          color: rgba(255,255,255,0.68);
          max-width: 720px;
        }

        .demoWrap {
          position: relative;
          margin-top: 26px;
          display: flex;
          justify-content: flex-end;
        }

        .demoGlow {
          position: absolute;
          width: 520px;
          height: 520px;
          right: 70px;
          top: 20px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(101,116,255,0.18), transparent 70%);
          filter: blur(44px);
          pointer-events: none;
        }

        .demoCard {
          position: relative;
          z-index: 1;
          width: min(820px, 100%);
          padding: 24px;
          border-radius: 28px;
          border: 1px solid rgba(255,255,255,0.08);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.035));
          backdrop-filter: blur(12px);
          box-shadow:
            0 24px 80px rgba(0,0,0,0.38),
            inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .demoHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
          flex-wrap: wrap;
        }

        .demoEyebrow {
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(174, 185, 255, 0.78);
        }

        .demoTitle {
          margin-top: 6px;
          font-size: 24px;
          font-weight: 800;
          color: white;
        }

        .demoStatus {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 13px;
          color: rgba(255,255,255,0.78);
        }

        .statusDot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #8fa0ff;
          box-shadow: 0 0 14px rgba(143,160,255,0.9);
        }

        .chatFlow {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .msg {
          max-width: 78%;
          padding: 16px 18px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.06);
          font-size: 16px;
          line-height: 1.65;
          box-shadow: 0 10px 24px rgba(0,0,0,0.18);
        }

        .msg p {
          margin: 0;
          color: rgba(255,255,255,0.92);
        }

        .msgLabel {
          margin-bottom: 8px;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.56);
        }

        .msg.student {
          align-self: flex-start;
          background: rgba(255,255,255,0.055);
        }

        .msg.vic {
          align-self: flex-end;
          background: rgba(98, 116, 255, 0.14);
        }

        .msg.highlight {
          align-self: flex-end;
          background: linear-gradient(135deg, rgba(101,116,255,0.2), rgba(123,97,255,0.18));
          border-color: rgba(159,176,255,0.18);
        }

        .demoFooter {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        .footerItem {
          padding: 10px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.74);
          font-size: 13px;
        }

        .compareSection {
          margin-top: 42px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .compareCard {
          padding: 26px;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
        }

        .compareCard.featured {
          background: linear-gradient(180deg, rgba(91,108,255,0.14), rgba(255,255,255,0.04));
          box-shadow: 0 20px 50px rgba(45, 62, 170, 0.16);
        }

        .compareCard.muted {
          opacity: 0.88;
        }

        .compareLabel {
          font-size: 12px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #9fb0ff;
          margin-bottom: 10px;
        }

        .compareCard h3 {
          margin: 0 0 14px;
          font-size: 28px;
          letter-spacing: -0.04em;
        }

        .compareCard ul {
          margin: 0;
          padding-left: 18px;
          color: rgba(255,255,255,0.74);
          line-height: 1.8;
          font-size: 16px;
        }

        .finalCta {
          margin-top: 42px;
        }

        .finalCard {
          padding: 34px 28px;
          border-radius: 28px;
          border: 1px solid rgba(255,255,255,0.08);
          background:
            radial-gradient(circle at top left, rgba(99,115,255,0.12), transparent 32%),
            rgba(255,255,255,0.04);
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.28);
        }

        .finalTitle {
          margin: 0;
          font-size: clamp(30px, 4vw, 50px);
          line-height: 1.04;
          letter-spacing: -0.05em;
        }

        .finalCopy {
          max-width: 760px;
          margin: 16px auto 0;
          font-size: 18px;
          line-height: 1.7;
          color: rgba(255,255,255,0.7);
        }

        @media (max-width: 980px) {
          .heroGrid {
            grid-template-columns: 1fr;
            gap: 26px;
          }

          .heroCopy {
            padding-right: 0;
          }

          .heroVisual {
            min-height: 500px;
          }

          .demoWrap {
            justify-content: center;
          }

          .compareSection {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .shell {
            padding: 18px 16px 60px;
          }

          .headline {
            font-size: clamp(38px, 11vw, 56px);
          }

          .subtext,
          .sectionCopy,
          .finalCopy {
            font-size: 16px;
          }

          .heroVisual {
            min-height: 420px;
          }

          .logoStage {
            height: 380px;
          }

          .logoHalo {
            width: 300px;
            height: 300px;
          }

          .logoRing {
            width: 240px;
            height: 240px;
            box-shadow:
              0 0 0 18px rgba(255,255,255,0.015),
              0 0 0 40px rgba(255,255,255,0.01);
          }

          .vicLogo {
            width: min(250px, 72vw);
          }

          .floatingCard {
            position: static;
            transform: none !important;
            max-width: 100%;
            margin-top: 12px;
          }

          .heroVisual {
            display: block;
          }

          .ctaRow {
            align-items: flex-start;
          }

          .cta,
          .cta.large {
            width: 100%;
            min-width: 0;
          }

          .msg {
            max-width: 100%;
          }

          .demoCard {
            padding: 18px;
          }

          .demoTitle {
            font-size: 21px;
          }

          .transitionText {
            font-size: 24px;
          }
        }
      `}</style>
    </>
  );
}
