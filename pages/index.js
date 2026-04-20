import { useState } from "react";
import { useRouter } from "next/router";
import VICHeader from "../components/VICHeader";

export default function Home() {
  const router = useRouter();

  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  async function askVIC(e) {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setReply("");

    try {
      const res = await fetch("/api/vic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are VIC, a helpful teacher. Answer the student's question clearly and simply in 2 to 4 sentences. Do not ask follow-up questions. Do not ask for grade level. Just help them understand.",
            },
            {
              role: "user",
              content: question,
            },
          ],
        }),
      });

      const data = await res.json();
      setReply(data.reply || "Sorry, I had trouble responding.");
    } catch (err) {
      setReply("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function openFullVIC() {
    const trimmed = question.trim();

    if (trimmed) {
      router.push(`/askvic?starter=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/askvic");
    }
  }

  return (
    <>
      <div className="page">
        <div className="ambient ambientLeft" />
        <div className="ambient ambientRight" />
        <div className="gridFade" />

        <main className="shell">
          <VICHeader currentPath="/" />
          <section className="hero">
            <div className="heroLeft">
              <div className="brandBlock">
                <div className="logoStage">
                  <div className="logoHalo" />
                  <div className="logoRing ringOne" />
                  <div className="logoRing ringTwo" />
                  <img src="/vic-logo.png" alt="VIC Logo" className="heroLogo" />
                </div>

                <div className="brandTextWrap">
                  <div className="brandName">VIC</div>
                  <div className="brandSub">Virtual Co-Teacher</div>
                </div>
              </div>

              <div className="eyebrow">Built to guide real learning</div>

              <h1 className="headline">
                VIC helps students
                <span> think things through.</span>
              </h1>

              <p className="subtext">
                Ask one real question and watch VIC respond right here.
              </p>

              <div className="quietProof">
                <span>Guides thinking</span>
                <span>Builds understanding</span>
                <span>Step-by-step support</span>
              </div>

              <div className="heroActions">
                <button className="primaryButton" onClick={openFullVIC}>
                  Open Full VIC
                </button>
                <a className="secondaryLink" href="/teacher">Teacher Portal</a>
                <a className="secondaryLink" href="/login">Log In</a>
                <a className="secondaryLink" href="/signup">Sign Up</a>
              </div>
            </div>

            <div className="heroRight">
              <div className="previewWrap">
                <div className="previewGlow" />

                <div className="phoneShell">
                  <div className="phoneTop">
                    <div className="phoneDot" />
                    <div className="phoneTitle">VIC Preview</div>
                  </div>

                  <div className="previewCard">
                    {!reply ? (
                      <form onSubmit={askVIC} className="askForm">
                        <label className="inputLabel" htmlFor="vic-question">
                          Ask VIC one question
                        </label>

                        <textarea
                          id="vic-question"
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          placeholder="Type your question here..."
                          rows={6}
                          disabled={loading}
                        />

                        <button
                          type="submit"
                          className="askButton"
                          disabled={!question.trim() || loading}
                        >
                          {loading ? "VIC is thinking..." : "Ask VIC"}
                        </button>
                      </form>
                    ) : (
                      <div className="responseView">
                        <div className="bubble userBubble">
                          <div className="bubbleLabel">You</div>
                          <p>{question}</p>
                        </div>

                        <div className="bubble vicBubble">
                          <div className="bubbleLabel">VIC</div>
                          <p>{reply}</p>
                        </div>

                        <button
                          type="button"
                          className="continueButton"
                          onClick={openFullVIC}
                        >
                          Continue in Full VIC
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer className="footer">
            © {new Date().getFullYear()} Designed by Dr. L Robert Furman — All rights reserved
          </footer>
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
          background: var(--vic-bg);
          color: var(--vic-text-primary);
        }

        * {
          box-sizing: border-box;
        }

        body {
          overflow-x: hidden;
          background:
            radial-gradient(circle at top left, rgba(74, 101, 255, 0.1), transparent 24%),
            radial-gradient(circle at bottom right, rgba(103, 72, 255, 0.08), transparent 26%),
            linear-gradient(180deg, var(--vic-bg) 0%, var(--vic-surface-muted) 48%, var(--vic-bg) 100%);
        }

        button,
        textarea {
          font: inherit;
        }

        .page {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
        }

        .ambient {
          position: absolute;
          border-radius: 999px;
          filter: blur(120px);
          pointer-events: none;
          opacity: 0.35;
        }

        .ambientLeft {
          width: 460px;
          height: 460px;
          left: -140px;
          top: 40px;
          background: rgba(37, 99, 235, 0.12);
        }

        .ambientRight {
          width: 460px;
          height: 460px;
          right: -120px;
          top: 80px;
          background: rgba(37, 99, 235, 0.08);
        }

        .gridFade {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: linear-gradient(180deg, rgba(15,23,42,0.12), transparent 84%);
          pointer-events: none;
        }

        .shell {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1320px;
          margin: 0 auto;
          padding: 36px 28px 42px;
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 460px;
          gap: 56px;
          align-items: start;
          min-height: calc(100vh - 120px);
        }

        .heroLeft {
          padding-top: 6px;
          max-width: 760px;
        }

        .brandBlock {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 28px;
        }

        .logoStage {
          position: relative;
          width: 170px;
          height: 170px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .logoHalo {
          position: absolute;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(110, 126, 255, 0.28) 0%,
            rgba(110, 126, 255, 0.1) 45%,
            transparent 78%
          );
          filter: blur(26px);
        }

        .logoRing {
          position: absolute;
          border-radius: 50%;
          border: 1px solid var(--vic-border-soft);
        }

        .ringOne {
          width: 112px;
          height: 112px;
        }

        .ringTwo {
          width: 148px;
          height: 148px;
          opacity: 0.5;
        }

        .heroLogo {
          position: relative;
          z-index: 2;
          width: 110px;
          height: auto;
          filter: drop-shadow(0 0 24px rgba(126, 137, 255, 0.35));
        }

        .brandTextWrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .brandName {
          font-size: 40px;
          font-weight: 800;
          letter-spacing: 0.02em;
          line-height: 1;
          color: var(--vic-text-primary);
        }

        .brandSub {
          font-size: 14px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--vic-text-secondary);
        }

        .eyebrow {
          margin-bottom: 18px;
          font-size: 13px;
          letter-spacing: 0.17em;
          text-transform: uppercase;
          color: var(--vic-primary);
        }

        .headline {
          margin: 0;
          font-size: clamp(46px, 5.8vw, 76px);
          line-height: 1.02;
          letter-spacing: -0.045em;
          font-weight: 800;
          max-width: 760px;
        }

        .headline span {
          display: block;
          color: var(--vic-text-primary);
        }

        .subtext {
          max-width: 620px;
          margin: 26px 0 0;
          font-size: 20px;
          line-height: 1.62;
          color: var(--vic-text-secondary);
        }

        .quietProof {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 30px;
        }

        .quietProof span {
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid var(--vic-border-soft);
          background: var(--vic-surface-muted);
          color: var(--vic-text-secondary);
          font-size: 14px;
        }

        .heroActions {
          margin-top: 34px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .primaryButton,
        .askButton,
        .continueButton {
          border: none;
          cursor: pointer;
          font-weight: 800;
          transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
        }

        .primaryButton {
          border-radius: 18px;
          padding: 16px 26px;
          color: var(--vic-text-primary);
          background: linear-gradient(135deg, var(--vic-primary) 0%, var(--vic-primary-hover) 58%, var(--vic-primary) 100%);
          box-shadow: var(--vic-shadow-card);
        }

        .primaryButton:hover,
        .askButton:hover,
        .continueButton:hover {
          transform: translateY(-1px);
        }

        .secondaryLink {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 12px 16px;
          color: var(--vic-text-primary);
          border: 1px solid var(--vic-border-soft);
          background: var(--vic-surface-muted);
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
        }

        .heroRight {
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
          padding-top: 10px;
        }

        .previewWrap {
          position: relative;
          width: 100%;
          max-width: 410px;
        }

        .previewGlow {
          position: absolute;
          inset: 36px 16px 18px 16px;
          border-radius: 38px;
          background: radial-gradient(circle, rgba(37,99,235,0.14), transparent 74%);
          filter: blur(44px);
          pointer-events: none;
        }

        .phoneShell {
          position: relative;
          z-index: 2;
          border-radius: 38px;
          padding: 14px;
          background: linear-gradient(180deg, var(--vic-surface) 0%, var(--vic-surface-muted) 100%);
          border: 1px solid var(--vic-border-soft);
          box-shadow: var(--vic-shadow-raised);
        }

        .phoneTop {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px 14px;
        }

        .phoneDot {
          width: 38px;
          height: 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.14);
          flex-shrink: 0;
        }

        .phoneTitle {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.04em;
          color: var(--vic-text-primary);
        }

        .previewCard {
          border-radius: 28px;
          overflow: hidden;
          background: #f8fbff;
          color: var(--vic-text-primary);
          min-height: 620px;
          display: flex;
          flex-direction: column;
        }

        .askForm,
        .responseView {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-height: 620px;
        }

        .inputLabel {
          font-size: 20px;
          font-weight: 800;
          color: var(--vic-text-primary);
        }

        .askForm textarea {
          width: 100%;
          border: 1px solid var(--vic-border);
          border-radius: 16px;
          outline: none;
          resize: none;
          background: var(--vic-surface);
          color: var(--vic-text-primary);
          font-size: 15px;
          line-height: 1.55;
          min-height: 180px;
          padding: 15px;
        }

        .askForm textarea::placeholder {
          color: var(--vic-text-secondary);
        }

        .askButton {
          border-radius: 14px;
          padding: 15px 16px;
          color: var(--vic-text-primary);
          background: linear-gradient(135deg, var(--vic-primary) 0%, var(--vic-primary-hover) 58%, var(--vic-primary) 100%);
          box-shadow: 0 10px 24px rgba(97,113,255,0.22);
        }

        .askButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .conversation {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .bubble {
          padding: 14px 15px;
          border-radius: 18px;
          line-height: 1.6;
          box-shadow: 0 8px 20px rgba(21, 33, 52, 0.06);
        }

        .bubbleLabel {
          font-size: 10px;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          margin-bottom: 6px;
          font-weight: 800;
        }

        .bubble p {
          margin: 0;
          font-size: 15px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .userBubble {
          background: var(--vic-surface);
          border: 1px solid var(--vic-border);
          color: var(--vic-text-primary);
        }

        .userBubble .bubbleLabel {
          color: var(--vic-text-secondary);
        }

        .vicBubble {
          background: linear-gradient(135deg, var(--vic-primary-soft) 0%, var(--vic-primary-soft) 100%);
          border: 1px solid var(--vic-border);
          color: var(--vic-text-primary);
        }

        .vicBubble .bubbleLabel {
          color: var(--vic-primary);
        }

        .continueButton {
          margin-top: auto;
          border-radius: 14px;
          padding: 15px 16px;
          color: var(--vic-text-primary);
          background: var(--vic-primary);
          box-shadow: 0 10px 24px rgba(0,0,0,0.16);
        }

        .footer {
          margin-top: 26px;
          text-align: center;
          font-size: 13px;
          color: var(--vic-text-muted);
          padding-bottom: 8px;
        }

        @media (max-width: 1100px) {
          .hero {
            grid-template-columns: 1fr;
            gap: 32px;
            min-height: auto;
          }

          .heroRight {
            justify-content: center;
          }

          .previewWrap {
            max-width: 430px;
          }
        }

        @media (max-width: 768px) {
          .shell {
            padding: 20px 14px 34px;
          }

          .brandBlock {
            gap: 14px;
            margin-bottom: 22px;
          }

          .logoStage {
            width: 120px;
            height: 120px;
          }

          .logoHalo {
            width: 105px;
            height: 105px;
          }

          .ringOne {
            width: 82px;
            height: 82px;
          }

          .ringTwo {
            width: 108px;
            height: 108px;
          }

          .heroLogo {
            width: 78px;
          }

          .brandName {
            font-size: 28px;
          }

          .brandSub {
            font-size: 12px;
          }

          .headline {
            font-size: clamp(40px, 12vw, 62px);
          }

          .subtext {
            font-size: 18px;
          }

          .previewWrap {
            max-width: 100%;
          }

          .previewCard,
          .askForm,
          .responseView {
            min-height: 580px;
          }
        }
      `}</style>
    </>
  );
}
