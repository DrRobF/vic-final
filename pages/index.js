import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  const promptText = "Help me solve 3/4 ÷ 1/2 step by step";
  const responseText =
    "Let’s walk through it together. Dividing by 1/2 means multiplying by 2...";

  const [typedPrompt, setTypedPrompt] = useState("");
  const [typedResponse, setTypedResponse] = useState("");

  useEffect(() => {
    let promptIndex = 0;
    let responseIndex = 0;
    let responseTimer;

    const promptTimer = setInterval(() => {
      promptIndex += 1;
      setTypedPrompt(promptText.slice(0, promptIndex));

      if (promptIndex >= promptText.length) {
        clearInterval(promptTimer);

        setTimeout(() => {
          responseTimer = setInterval(() => {
            responseIndex += 1;
            setTypedResponse(responseText.slice(0, responseIndex));

            if (responseIndex >= responseText.length) {
              clearInterval(responseTimer);
            }
          }, 28);
        }, 500);
      }
    }, 42);

    return () => {
      clearInterval(promptTimer);
      clearInterval(responseTimer);
    };
  }, []);

  return (
    <>
      <div className="page">
        <div className="bg-grid" />
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <div className="glow glow-3" />
        <div className="noise" />
        <div className="vignette" />

        <main className="hero">
          <div className="badge">Virtual Co-Teacher</div>

          <div className="logoWrap">
            <div className="logoRing ring-1" />
            <div className="logoRing ring-2" />
            <div className="logoCore" />
            <h1 className="logo">VIC</h1>
          </div>

          <div className="heroShell">
            <section className="heroCopy">
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
            </section>

            <section className="demoCard">
              <div className="demoTop">
                <div className="dots">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="demoLabel">Live preview</div>
              </div>

              <div className="demoBody">
                <div className="chatRow user">
                  <div className="bubble userBubble">
                    <div className="bubbleLabel">You</div>
                    <div className="bubbleText">
                      {typedPrompt}
                      <span className="cursor">|</span>
                    </div>
                  </div>
                </div>

                <div className="chatRow vic">
                  <div className="bubble vicBubble">
                    <div className="bubbleLabel vicName">VIC</div>
                    <div className="bubbleText responseText">
                      {typedResponse}
                      {typedResponse.length < responseText.length && (
                        <span className="cursor">|</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="demoBottom">
                <span>Personalized help</span>
                <span>Step-by-step guidance</span>
              </div>
            </section>
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
            radial-gradient(circle at 18% 22%, rgba(72, 103, 255, 0.18), transparent 26%),
            radial-gradient(circle at 82% 24%, rgba(123, 73, 255, 0.16), transparent 24%),
            radial-gradient(circle at 48% 76%, rgba(0, 194, 255, 0.10), transparent 28%),
            linear-gradient(180deg, #050505 0%, #07070a 45%, #040404 100%);
          color: white;
        }

        .bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
          background-size: 46px 46px;
          mask-image: radial-gradient(circle at center, black 38%, transparent 88%);
          opacity: 0.35;
          pointer-events: none;
        }

        .noise {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(255,255,255,0.03) 0.7px, transparent 0.7px);
          background-size: 10px 10px;
          opacity: 0.16;
          mix-blend-mode: soft-light;
          pointer-events: none;
        }

        .vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, transparent 42%, rgba(0, 0, 0, 0.42) 100%);
          pointer-events: none;
        }

        .glow {
          position: absolute;
          border-radius: 999px;
          filter: blur(100px);
          opacity: 0.56;
          animation: floatGlow 12s ease-in-out infinite;
          pointer-events: none;
        }

        .glow-1 {
          width: 360px;
          height: 360px;
          top: 8%;
          left: 12%;
          background: rgba(83, 108, 255, 0.34);
        }

        .glow-2 {
          width: 300px;
          height: 300px;
          right: 10%;
          top: 18%;
          background: rgba(127, 74, 255, 0.28);
          animation-delay: 1.4s;
        }

        .glow-3 {
          width: 340px;
          height: 340px;
          left: 36%;
          bottom: 8%;
          background: rgba(0, 188, 255, 0.14);
          animation-delay: 2.2s;
        }

        .hero {
          position: relative;
          z-index: 2;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 42px 20px 32px;
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
          color: rgba(255, 255, 255, 0.85);
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin-bottom: 22px;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.02) inset;
        }

        .logoWrap {
          position: relative;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 22px;
          min-height: 160px;
        }

        .logoRing,
        .logoCore {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          pointer-events: none;
        }

        .logoRing {
          border: 1px solid rgba(145, 157, 255, 0.16);
          animation: pulseRing 5s ease-in-out infinite;
        }

        .ring-1 {
          width: 190px;
          height: 190px;
        }

        .ring-2 {
          width: 250px;
          height: 250px;
          animation-delay: 1.2s;
          opacity: 0.55;
        }

        .logoCore {
          width: 170px;
          height: 170px;
          background: radial-gradient(circle, rgba(97, 113, 255, 0.25) 0%, rgba(97, 113, 255, 0.08) 45%, transparent 74%);
          filter: blur(18px);
        }

        .logo {
          position: relative;
          margin: 0;
          font-size: clamp(88px, 14vw, 170px);
          font-weight: 900;
          line-height: 0.88;
          letter-spacing: -0.08em;
          background: linear-gradient(180deg, #ffffff 0%, #edf0ff 38%, #c6d0ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow:
            0 0 24px rgba(123, 133, 255, 0.18),
            0 0 50px rgba(123, 133, 255, 0.12);
        }

        .heroShell {
          width: 100%;
          max-width: 1220px;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 26px;
          align-items: stretch;
        }

        .heroCopy,
        .demoCard {
          border-radius: 30px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.08) 0%,
            rgba(255, 255, 255, 0.04) 100%
          );
          backdrop-filter: blur(22px);
          box-shadow:
            0 20px 80px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .heroCopy {
          text-align: left;
          padding: 38px 38px 34px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: 520px;
        }

        .eyebrow {
          margin: 0 0 16px;
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(180, 188, 255, 0.80);
        }

        .headline {
          margin: 0;
          font-size: clamp(42px, 5vw, 78px);
          line-height: 0.98;
          font-weight: 850;
          letter-spacing: -0.05em;
          color: #ffffff;
        }

        .headline span {
          display: inline-block;
          background: linear-gradient(90deg, #ffffff 0%, #ccd5ff 42%, #92a5ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .subtext {
          max-width: 700px;
          margin: 22px 0 0;
          font-size: clamp(18px, 2vw, 23px);
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.74);
        }

        .ctaRow {
          display: flex;
          justify-content: flex-start;
          margin-top: 30px;
        }

        .cta {
          appearance: none;
          border: none;
          cursor: pointer;
          padding: 18px 34px;
          min-width: 220px;
          border-radius: 16px;
          font-size: 20px;
          font-weight: 800;
          color: white;
          background: linear-gradient(135deg, #6574ff 0%, #7b61ff 55%, #4c7dff 100%);
          box-shadow:
            0 16px 44px rgba(97, 113, 255, 0.38),
            0 0 30px rgba(97, 113, 255, 0.24);
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }

        .cta:hover {
          transform: translateY(-2px) scale(1.015);
          box-shadow:
            0 20px 54px rgba(97, 113, 255, 0.50),
            0 0 38px rgba(97, 113, 255, 0.30);
          filter: brightness(1.06);
        }

        .cta:active {
          transform: translateY(0);
        }

        .microFeatures {
          margin-top: 24px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .microFeatures span {
          padding: 11px 16px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.10);
          color: rgba(255, 255, 255, 0.90);
          font-size: 14px;
          font-weight: 500;
          backdrop-filter: blur(10px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .demoCard {
          padding: 18px 18px 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 520px;
          text-align: left;
          overflow: hidden;
          position: relative;
        }

        .demoCard::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at top right, rgba(103, 114, 255, 0.16), transparent 32%),
            radial-gradient(circle at bottom left, rgba(0, 194, 255, 0.10), transparent 34%);
          pointer-events: none;
        }

        .demoTop,
        .demoBody,
        .demoBottom {
          position: relative;
          z-index: 1;
        }

        .demoTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2px 4px 14px;
        }

        .dots {
          display: flex;
          gap: 7px;
        }

        .dots span {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.18);
        }

        .dots span:nth-child(1) {
          background: rgba(255, 110, 110, 0.7);
        }

        .dots span:nth-child(2) {
          background: rgba(255, 205, 90, 0.75);
        }

        .dots span:nth-child(3) {
          background: rgba(98, 214, 121, 0.72);
        }

        .demoLabel {
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(190, 198, 255, 0.78);
        }

        .demoBody {
          display: flex;
          flex-direction: column;
          gap: 18px;
          margin-top: 8px;
          flex: 1;
          justify-content: center;
        }

        .chatRow {
          display: flex;
          width: 100%;
        }

        .chatRow.user {
          justify-content: flex-end;
        }

        .chatRow.vic {
          justify-content: flex-start;
        }

        .bubble {
          width: min(100%, 340px);
          border-radius: 22px;
          padding: 16px 16px 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.26);
        }

        .userBubble {
          background: linear-gradient(135deg, rgba(101, 116, 255, 0.92), rgba(120, 97, 255, 0.88));
        }

        .vicBubble {
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(12px);
        }

        .bubbleLabel {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.82);
          margin-bottom: 10px;
        }

        .vicName {
          color: rgba(200, 208, 255, 0.92);
        }

        .bubbleText {
          font-size: 16px;
          line-height: 1.55;
          color: white;
          min-height: 48px;
          word-break: break-word;
        }

        .responseText {
          color: rgba(255, 255, 255, 0.88);
        }

        .cursor {
          display: inline-block;
          opacity: 0.85;
          animation: blink 1s steps(1) infinite;
        }

        .demoBottom {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          padding-top: 12px;
        }

        .demoBottom span {
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.82);
          font-size: 13px;
        }

        .bottomLine {
          margin-top: 20px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.50);
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

        @keyframes blink {
          0%,
          50% {
            opacity: 1;
          }
          51%,
          100% {
            opacity: 0;
          }
        }

        @keyframes pulseRing {
          0%,
          100% {
            opacity: 0.45;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 0.75;
            transform: translate(-50%, -50%) scale(1.03);
          }
        }

        @media (max-width: 1050px) {
          .heroShell {
            grid-template-columns: 1fr;
            max-width: 860px;
          }

          .heroCopy,
          .demoCard {
            min-height: auto;
          }

          .heroCopy {
            text-align: center;
            padding: 30px 24px 28px;
          }

          .ctaRow {
            justify-content: center;
          }

          .microFeatures {
            justify-content: center;
          }
        }

        @media (max-width: 768px) {
          .hero {
            padding: 28px 14px 24px;
          }

          .logoWrap {
            min-height: 120px;
            margin-bottom: 14px;
          }

          .ring-1 {
            width: 140px;
            height: 140px;
          }

          .ring-2 {
            width: 185px;
            height: 185px;
          }

          .logoCore {
            width: 130px;
            height: 130px;
          }

          .heroCopy,
          .demoCard {
            border-radius: 22px;
          }

          .heroCopy {
            padding: 24px 18px 22px;
          }

          .demoCard {
            padding: 16px 14px 14px;
          }

          .headline {
            font-size: clamp(34px, 10vw, 52px);
          }

          .subtext {
            font-size: 17px;
          }

          .cta {
            width: 100%;
            max-width: 320px;
            font-size: 18px;
          }

          .bubble {
            width: 100%;
          }

          .bubbleText {
            font-size: 15px;
          }
        }
      `}</style>
    </>
  );
}
