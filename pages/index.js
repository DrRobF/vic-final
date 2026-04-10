import { useState } from "react";
import { useRouter } from "next/router";

const SUGGESTIONS = [
  "Why do we flip fractions?",
  "What is the difference between area and perimeter?",
  "Can you help me solve 3x + 5 = 17?",
];

export default function Home() {
  const router = useRouter();

  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAsk(e) {
    e.preventDefault();

    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setError("");
    setReply("");
    setSubmittedQuestion(trimmed);

    try {
      const response = await fetch("/api/vic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: trimmed }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "VIC could not respond right now.");
      }

      setReply(data?.reply || "VIC could not respond right now.");
    } catch (err) {
      setError(err.message || "VIC could not respond right now.");
    } finally {
      setIsLoading(false);
    }
  }

  function useSuggestion(text) {
    setQuestion(text);
    setError("");
  }

  function resetPreview() {
    setQuestion("");
    setSubmittedQuestion("");
    setReply("");
    setError("");
    setIsLoading(false);
  }

  function openFullVIC() {
    const starter = (submittedQuestion || question).trim();

    if (starter) {
      router.push(`/askvic?starter=${encodeURIComponent(starter)}`);
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
          <div className="brand">
            <img src="/vic-logo.png" alt="VIC Logo" className="brandLogo" />
            <div className="brandTextWrap">
              <div className="brandText">VIC</div>
              <div className="brandSub">Virtual Co-Teacher</div>
            </div>
          </div>

          <section className="hero">
            <div className="heroLeft">
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
              </div>
            </div>

            <div className="heroRight">
              <div className="phoneWrap">
                <div className="phoneGlow" />

                <div className="phoneShell">
                  <div className="miniApp">
                    <div className="launcherCard">
                      {!reply && !submittedQuestion ? (
                        <>
                          <label className="inputLabel" htmlFor="vic-question">
                            Ask VIC one question
                          </label>

                          <textarea
                            id="vic-question"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Type your question here..."
                            rows={6}
                            disabled={isLoading}
                          />

                          <div className="suggestions">
                            {SUGGESTIONS.map((item) => (
                              <button
                                key={item}
                                type="button"
                                className="suggestionChip"
                                onClick={() => useSuggestion(item)}
                                disabled={isLoading}
                              >
                                {item}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            className="launchButton"
                            onClick={handleAsk}
                            disabled={!question.trim() || isLoading}
                          >
                            {isLoading ? "VIC is thinking..." : "Ask VIC"}
                          </button>

                          {error ? <div className="errorBox">{error}</div> : null}
                        </>
                      ) : (
                        <>
                          <div className="conversation">
                            <div className="bubble userBubble">
                              <div className="bubbleLabel">You</div>
                              <p>{submittedQuestion}</p>
                            </div>

                            {isLoading ? (
                              <div className="bubble vicBubble">
                                <div className="bubbleLabel">VIC</div>
                                <p>Thinking it through...</p>
                              </div>
                            ) : null}

                            {!isLoading && reply ? (
                              <div className="bubble vicBubble">
                                <div className="bubbleLabel">VIC</div>
                                <p>{reply}</p>
                              </div>
                            ) : null}

                            {error ? <div className="errorBox">{error}</div> : null}
                          </div>

                          <div className="followupActions">
                            <button
                              type="button"
                              className="launchButton"
                              onClick={openFullVIC}
                            >
                              Continue in Full VIC
                            </button>

                            <button
                              type="button"
                              className="secondaryButton"
                              onClick={resetPreview}
                            >
                              Ask another question
                            </button>
                          </div>
                        </>
                      )}
                    </div>
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
          background: #050505;
          color: white;
        }

        * {
          box-sizing: border-box;
        }

        body {
          overflow-x: hidden;
          background:
            radial-gradient(circle at top left, rgba(74, 101, 255, 0.1), transparent 24%),
            radial-gradient(circle at bottom right, rgba(103, 72, 255, 0.08), transparent 26%),
            linear-gradient(180deg, #040404 0%, #090910 48%, #040404 100%);
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
          filter: blur(100px);
          pointer-events: none;
          opacity: 0.8;
        }

        .ambientLeft {
          width: 420px;
          height: 420px;
          left: -120px;
          top: 70px;
          background: rgba(73, 100, 255, 0.14);
        }

        .ambientRight {
          width: 420px;
          height: 420px;
          right: -120px;
          top: 120px;
          background: rgba(100, 72, 255, 0.13);
        }

        .gridFade {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 46px 46px;
          mask-image: linear-gradient(180deg, rgba(255,255,255,0.22), transparent 78%);
          pointer-events: none;
        }

        .shell {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1320px;
          margin: 0 auto;
          padding: 28px 22px 40px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 26px;
        }

        .brandLogo {
          width: 84px;
          height: 84px;
          object-fit: contain;
          filter: drop-shadow(0 0 22px rgba(126, 137, 255, 0.28));
          flex-shrink: 0;
        }

        .brandTextWrap {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .brandText {
          font-size: 30px;
          font-weight: 800;
          letter-spacing: 0.04em;
          color: rgba(255,255,255,0.96);
          line-height: 1;
        }

        .brandSub {
          font-size: 13px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.58);
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(390px, 430px);
          gap: 48px;
          align-items: start;
          min-height: calc(100vh - 170px);
        }

        .heroLeft {
          padding-top: 28px;
          max-width: 760px;
        }

        .eyebrow {
          margin-bottom: 18px;
          font-size: 13px;
          letter-spacing: 0.17em;
          text-transform: uppercase;
          color: #8fa2ff;
        }

        .headline {
          margin: 0;
          font-size: clamp(46px, 6vw, 82px);
          line-height: 0.95;
          letter-spacing: -0.065em;
          font-weight: 800;
          max-width: 760px;
        }

        .headline span {
          display: block;
          color: rgba(255,255,255,0.92);
        }

        .subtext {
          max-width: 600px;
          margin: 24px 0 0;
          font-size: 21px;
          line-height: 1.65;
          color: rgba(255,255,255,0.72);
        }

        .quietProof {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 28px;
        }

        .quietProof span {
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.8);
          font-size: 14px;
        }

        .heroActions {
          margin-top: 30px;
        }

        .primaryButton,
        .launchButton,
        .secondaryButton {
          border: none;
          cursor: pointer;
          font-weight: 800;
          transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
        }

        .primaryButton {
          border-radius: 18px;
          padding: 16px 24px;
          color: white;
          background: linear-gradient(135deg, #6675ff 0%, #7a60ff 58%, #4f7cff 100%);
          box-shadow: 0 16px 44px rgba(97,113,255,0.32);
        }

        .primaryButton:hover,
        .launchButton:hover,
        .secondaryButton:hover,
        .suggestionChip:hover {
          transform: translateY(-1px);
        }

        .heroRight {
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
          padding-top: 12px;
        }

        .phoneWrap {
          position: relative;
          width: 100%;
          max-width: 400px;
          margin-left: auto;
        }

        .phoneGlow {
          position: absolute;
          inset: 40px 18px 20px 18px;
          border-radius: 36px;
          background: radial-gradient(circle, rgba(96,112,255,0.18), transparent 72%);
          filter: blur(42px);
          pointer-events: none;
        }

        .phoneShell {
          position: relative;
          z-index: 2;
          border-radius: 38px;
          padding: 14px;
          background: linear-gradient(180deg, #151515 0%, #090909 100%);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 30px 80px rgba(0,0,0,0.42),
            inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .miniApp {
          border-radius: 28px;
          overflow: hidden;
          background: #f5f7fb;
          color: #101418;
          min-height: 620px;
          display: flex;
          flex-direction: column;
        }

        .launcherCard {
          flex: 1;
          background: #f5f7fb;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .inputLabel {
          font-size: 18px;
          font-weight: 800;
          color: #132033;
        }

        .launcherCard textarea {
          width: 100%;
          border: 1px solid #dde6f3;
          border-radius: 16px;
          outline: none;
          resize: none;
          background: #ffffff;
          color: #17212b;
          font-size: 15px;
          line-height: 1.55;
          min-height: 140px;
          padding: 14px;
        }

        .launcherCard textarea::placeholder {
          color: #8b96a8;
        }

        .suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .suggestionChip {
          border: none;
          background: #e8eef8;
          color: #41536e;
          padding: 8px 11px;
          border-radius: 999px;
          font-size: 12px;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .suggestionChip:hover {
          background: #dfe8f7;
        }

        .launchButton {
          border-radius: 14px;
          padding: 15px 16px;
          color: white;
          background: linear-gradient(135deg, #6675ff 0%, #7a60ff 58%, #4f7cff 100%);
          box-shadow: 0 10px 24px rgba(97,113,255,0.22);
        }

        .launchButton:disabled {
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
          align-self: flex-start;
          background: #ffffff;
          border: 1px solid #e3e9f3;
          color: #17212b;
        }

        .userBubble .bubbleLabel {
          color: #7a8798;
        }

        .vicBubble {
          align-self: flex-start;
          background: linear-gradient(135deg, #edf1ff 0%, #e5ebff 100%);
          border: 1px solid #d2ddff;
          color: #1f2950;
        }

        .vicBubble .bubbleLabel {
          color: #5670d8;
        }

        .followupActions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 4px;
        }

        .secondaryButton {
          border-radius: 14px;
          padding: 13px 16px;
          background: #e9eef8;
          color: #30425c;
        }

        .errorBox {
          border-radius: 14px;
          padding: 12px 14px;
          background: #fff1f3;
          border: 1px solid #f2c9d0;
          color: #b23a4a;
          font-size: 14px;
          line-height: 1.5;
        }

        .footer {
          margin-top: 22px;
          text-align: center;
          font-size: 13px;
          color: rgba(255,255,255,0.42);
          padding-bottom: 8px;
        }

        @media (max-width: 1100px) {
          .hero {
            grid-template-columns: 1fr;
            gap: 32px;
            min-height: auto;
          }

          .heroLeft {
            max-width: 100%;
            padding-top: 12px;
          }

          .heroRight {
            justify-content: center;
          }

          .phoneWrap {
            margin-left: 0;
          }
        }

        @media (max-width: 768px) {
          .shell {
            padding: 18px 14px 32px;
          }

          .brand {
            gap: 12px;
            margin-bottom: 20px;
          }

          .brandLogo {
            width: 62px;
            height: 62px;
          }

          .brandText {
            font-size: 24px;
          }

          .headline {
            font-size: clamp(40px, 12vw, 62px);
          }

          .subtext {
            font-size: 18px;
          }

          .phoneWrap {
            max-width: 100%;
          }

          .miniApp {
            min-height: 600px;
          }
        }
      `}</style>
    </>
  );
}
