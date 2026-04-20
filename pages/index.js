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
          color: #4b5f79;
        }

        * {
          box-sizing: border-box;
        }

        body {
          overflow-x: hidden;
          background: linear-gradient(180deg, #e8eff8 0%, #edf3fb 52%, #e7edf5 100%);
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
          opacity: 0.22;
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
          background-size: 72px 72px;
          mask-image: linear-gradient(180deg, rgba(15,23,42,0.12), transparent 84%);
          pointer-events: none;
        }

        .shell {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1240px;
          margin: 0 auto;
          padding: 32px 28px 48px;
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 430px;
          gap: 44px;
          align-items: start;
          min-height: calc(100vh - 120px);
        }

        .heroLeft {
          padding-top: 14px;
          max-width: 700px;
        }

        .brandBlock {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 22px;
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
          font-weight: 900;
          letter-spacing: 0.02em;
          line-height: 1;
          color: #4b5f79;
        }

        .brandSub {
          font-size: 14px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #4b5f79;
        }

        .eyebrow {
          margin-bottom: 14px;
          font-size: 13px;
          letter-spacing: 0.17em;
          text-transform: uppercase;
          color: var(--vic-primary);
        }

        .headline {
          margin: 0;
          font-size: clamp(54px, 5.8vw, 82px);
          line-height: 0.98;
          letter-spacing: -0.045em;
          font-weight: 900;
          max-width: 760px;
        }

        .headline span {
          display: block;
          color: #0b1220;
        }

        .subtext {
          max-width: 620px;
          margin: 20px 0 0;
          font-size: 19px;
          line-height: 1.55;
          color: #4b5f79;
        }

        .quietProof {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 24px;
        }

        .quietProof span {
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid #d2def0;
          background: #f5f8ff;
          color: #4b5f79;
          font-size: 14px;
        }

        .heroActions {
          margin-top: 28px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .primaryButton,
        .askButton,
        .continueButton {
          border: none;
          cursor: pointer;
          font-weight: 900;
          transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
        }

        .primaryButton {
          border-radius: 12px;
          padding: 14px 24px;
          color: var(--vic-surface);
          background: linear-gradient(135deg, var(--vic-primary) 0%, var(--vic-primary-hover) 58%, var(--vic-primary) 100%);
          box-shadow: 0 14px 30px rgba(29, 78, 216, 0.34);
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
          border-radius: 10px;
          padding: 10px 14px;
          color: #4b5f79;
          border: 1px solid #d2def0;
          background: #f5f8ff;
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
        }

        .heroRight {
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
          padding-top: 0;
        }

        .previewWrap {
          position: relative;
          width: 100%;
          max-width: 430px;
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
          border-radius: 24px;
          padding: 12px;
          background: linear-gradient(180deg, #ffffff 0%, #f0f5fd 100%);
          border: 1px solid #c9d7eb;
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
          font-weight: 900;
          letter-spacing: 0.04em;
          color: #4b5f79;
        }

        .previewCard {
          border-radius: 16px;
          overflow: hidden;
          background: #ffffff;
          color: #4b5f79;
          min-height: 620px;
          display: flex;
          flex-direction: column;
        }

        .askForm,
        .responseView {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-height: 620px;
        }

        .inputLabel {
          font-size: 18px;
          font-weight: 900;
          color: #4b5f79;
        }

        .askForm textarea {
          width: 100%;
          border: 1px solid #b9c9de;
          border-radius: 12px;
          outline: none;
          resize: none;
          background: var(--vic-surface);
          color: #4b5f79;
          font-size: 15px;
          line-height: 1.55;
          min-height: 180px;
          padding: 15px;
        }

        .askForm textarea::placeholder {
          color: #4b5f79;
        }

        .askButton {
          border-radius: 10px;
          padding: 15px 16px;
          color: var(--vic-surface);
          background: linear-gradient(135deg, var(--vic-primary) 0%, var(--vic-primary-hover) 58%, var(--vic-primary) 100%);
          box-shadow: 0 12px 26px rgba(29,78,216,0.28);
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
          font-weight: 900;
        }

        .bubble p {
          margin: 0;
          font-size: 15px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .userBubble {
          background: var(--vic-surface);
          border: 1px solid #b9c9de;
          color: #4b5f79;
        }

        .userBubble .bubbleLabel {
          color: #4b5f79;
        }

        .vicBubble {
          background: linear-gradient(135deg, var(--vic-primary-soft) 0%, var(--vic-primary-soft) 100%);
          border: 1px solid #b9c9de;
          color: #4b5f79;
        }

        .vicBubble .bubbleLabel {
          color: var(--vic-primary);
        }

        .continueButton {
          margin-top: auto;
          border-radius: 10px;
          padding: 15px 16px;
          color: var(--vic-surface);
          background: var(--vic-primary);
          box-shadow: 0 10px 24px rgba(0,0,0,0.16);
        }

        .footer {
          margin-top: 34px;
          text-align: center;
          font-size: 13px;
          color: var(--vic-text-muted);
          padding-bottom: 8px;
        }

        @media (max-width: 1100px) {
          .hero {
            grid-template-columns: 1fr;
            gap: 30px;
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
