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
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setSubmitted(true);
  }

  function useSuggestion(text) {
    setQuestion(text);
    setSubmitted(false);
  }

  function goToFullVIC() {
    if (question.trim()) {
      router.push(`/askvic?starter=${encodeURIComponent(question.trim())}`);
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
          <div className="topBadge">Virtual Co-Teacher</div>

          <section className="hero">
            <div className="heroLeft">
              <div className="eyebrow">Not another answer machine</div>

              <h1 className="headline">
                This doesn’t just answer questions.
                <span> It teaches students how to think.</span>
              </h1>

              <p className="subtext">
                A calm first look at VIC. Try one question in the preview and
                step into the full experience when you’re ready.
              </p>

              <div className="quietProof">
                <span>Guides thinking</span>
                <span>Checks understanding</span>
                <span>Hints, not shortcuts</span>
              </div>

              <div className="heroActions">
                <button className="primaryButton" onClick={goToFullVIC}>
                  Open Full VIC
                </button>
                <div className="heroNote">
                  Start in the preview or jump straight into the main portal.
                </div>
              </div>
            </div>

            <div className="heroRight">
              <div className="phoneWrap">
                <div className="phoneGlow" />
                <div className="phoneShell">
                  <div className="phoneTopBar">
                    <div className="phoneCam" />
                    <div className="phoneTitle">VIC Preview</div>
                    <div className="phoneStatus">1 question</div>
                  </div>

                  <div className="miniApp">
                    <div className="miniHeader">
                      <img
                        src="/vic-logo.png"
                        alt="VIC Logo"
                        className="miniLogo"
                      />
                      <div>
                        <div className="miniHeaderTitle">Ask VIC one question</div>
                        <div className="miniHeaderSub">
                          A small preview of the full teaching experience
                        </div>
                      </div>
                    </div>

                    <div className="miniWorkspace">
                      <div className="workspaceTabs">
                        <span className="tab active">Chat</span>
                        <span className="tab">Practice</span>
                        <span className="tab">Sketch</span>
                      </div>

                      <div className="chatArea">
                        {!submitted ? (
                          <>
                            <div className="bubble student demo">
                              <div className="bubbleLabel">Student</div>
                              <p>Wait... why do we flip the fraction?</p>
                            </div>

                            <div className="bubble vic demo">
                              <div className="bubbleLabel">VIC</div>
                              <p>
                                Before we flip it, what does dividing mean here?
                              </p>
                            </div>

                            <div className="bubble vic soft">
                              <div className="bubbleLabel">VIC</div>
                              <p>
                                Try your own question below to preview the full
                                experience.
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="bubble student">
                              <div className="bubbleLabel">Student</div>
                              <p>{question}</p>
                            </div>

                            <div className="bubble vic">
                              <div className="bubbleLabel">VIC</div>
                              <p>
                                Nice question. In the live version, VIC would
                                respond here and guide the student step-by-step
                                instead of rushing straight to the answer.
                              </p>
                            </div>

                            <div className="continuePrompt">
                              <div className="continueKicker">
                                Continue in full VIC
                              </div>
                              <button
                                className="smallPrimaryButton"
                                onClick={goToFullVIC}
                              >
                                Open full session
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      <form className="inputZone" onSubmit={handleSubmit}>
                        <textarea
                          value={question}
                          onChange={(e) => {
                            setQuestion(e.target.value);
                            setSubmitted(false);
                          }}
                          placeholder="Type one question for VIC..."
                          rows={3}
                        />

                        <div className="suggestions">
                          {SUGGESTIONS.map((item) => (
                            <button
                              key={item}
                              type="button"
                              className="suggestionChip"
                              onClick={() => useSuggestion(item)}
                            >
                              {item}
                            </button>
                          ))}
                        </div>

                        <div className="inputActions">
                          <button type="submit" className="smallPrimaryButton">
                            Preview VIC
                          </button>
                          <button
                            type="button"
                            className="smallSecondaryButton"
                            onClick={goToFullVIC}
                          >
                            Full VIC
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
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
          background: #040404;
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
          opacity: 0.82;
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
          mask-image: linear-gradient(180deg, rgba(255,255,255,0.28), transparent 78%);
          pointer-events: none;
        }

        .shell {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1320px;
          margin: 0 auto;
          padding: 28px 22px 48px;
        }

        .topBadge {
          width: fit-content;
          margin: 0 auto 22px;
          padding: 10px 16px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.78);
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          backdrop-filter: blur(10px);
        }

        .hero {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 40px;
          align-items: start;
          min-height: 82vh;
          padding-top: 14px;
        }

        .heroLeft {
          padding-top: 56px;
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
          font-size: clamp(46px, 6vw, 86px);
          line-height: 0.95;
          letter-spacing: -0.065em;
          font-weight: 800;
          max-width: 720px;
        }

        .headline span {
          display: block;
          color: rgba(255,255,255,0.92);
        }

        .subtext {
          max-width: 620px;
          margin: 24px 0 0;
          font-size: 21px;
          line-height: 1.7;
          color: rgba(255,255,255,0.68);
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
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.74);
          font-size: 14px;
        }

        .heroActions {
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
          margin-top: 30px;
        }

        .heroNote {
          color: rgba(255,255,255,0.58);
          font-size: 15px;
          max-width: 320px;
          line-height: 1.55;
        }

        .heroRight {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding-top: 10px;
        }

        .phoneWrap {
          position: relative;
          width: 100%;
          max-width: 470px;
        }

        .phoneGlow {
          position: absolute;
          inset: 50px 30px 10px 30px;
          border-radius: 36px;
          background: radial-gradient(circle, rgba(96,112,255,0.18), transparent 72%);
          filter: blur(40px);
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

        .phoneTopBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 10px 14px;
          color: rgba(255,255,255,0.72);
          font-size: 13px;
        }

        .phoneCam {
          width: 42px;
          height: 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.12);
        }

        .phoneTitle {
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .phoneStatus {
          color: #9db0ff;
          font-size: 12px;
        }

        .miniApp {
          border-radius: 28px;
          overflow: hidden;
          background: #f5f7fb;
          color: #101418;
          min-height: 720px;
          display: flex;
          flex-direction: column;
        }

        .miniHeader {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 18px 18px 14px;
          background: white;
          border-bottom: 1px solid #e8edf5;
        }

        .miniLogo {
          width: 42px;
          height: 42px;
          object-fit: contain;
          border-radius: 12px;
          background: #eff3ff;
          padding: 6px;
        }

        .miniHeaderTitle {
          font-size: 18px;
          font-weight: 800;
          color: #0f1720;
        }

        .miniHeaderSub {
          margin-top: 3px;
          font-size: 13px;
          color: #68768a;
          line-height: 1.4;
        }

        .miniWorkspace {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 14px;
          gap: 12px;
        }

        .workspaceTabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .tab {
          padding: 8px 12px;
          border-radius: 999px;
          background: #e9eef8;
          color: #55657c;
          font-size: 13px;
          font-weight: 700;
        }

        .tab.active {
          background: #dfe7ff;
          color: #3251d2;
        }

        .chatArea {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 6px 0;
        }

        .bubble {
          max-width: 88%;
          padding: 12px 14px;
          border-radius: 18px;
          box-shadow: 0 8px 20px rgba(21, 33, 52, 0.06);
        }

        .bubbleLabel {
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 6px;
          font-weight: 700;
        }

        .bubble p {
          margin: 0;
          font-size: 15px;
          line-height: 1.6;
        }

        .bubble.student {
          align-self: flex-start;
          background: white;
          color: #17212b;
          border: 1px solid #e6ebf2;
        }

        .bubble.student .bubbleLabel {
          color: #7a8798;
        }

        .bubble.vic {
          align-self: flex-end;
          background: linear-gradient(135deg, #eef2ff 0%, #e7ecff 100%);
          color: #1f2950;
          border: 1px solid #d7e0ff;
        }

        .bubble.vic .bubbleLabel {
          color: #5870d8;
        }

        .bubble.demo {
          opacity: 0.96;
        }

        .bubble.soft {
          background: #f8faff;
        }

        .continuePrompt {
          margin-top: 4px;
          padding: 14px;
          border-radius: 18px;
          background: white;
          border: 1px solid #e6ebf2;
        }

        .continueKicker {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #6c7da2;
          font-weight: 800;
          margin-bottom: 10px;
        }

        .inputZone {
          background: white;
          border: 1px solid #e6ebf2;
          border-radius: 20px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .inputZone textarea {
          width: 100%;
          border: none;
          outline: none;
          resize: none;
          background: transparent;
          color: #17212b;
          font-size: 15px;
          line-height: 1.6;
        }

        .inputZone textarea::placeholder {
          color: #8b96a8;
        }

        .suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .suggestionChip {
          border: none;
          background: #eef2f8;
          color: #4d5f79;
          padding: 8px 10px;
          border-radius: 999px;
          font-size: 12px;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .suggestionChip:hover {
          transform: translateY(-1px);
          background: #e4ebf8;
        }

        .inputActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .primaryButton,
        .smallPrimaryButton,
        .smallSecondaryButton {
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
        .smallPrimaryButton:hover,
        .smallSecondaryButton:hover {
          transform: translateY(-1px);
        }

        .smallPrimaryButton {
          border-radius: 14px;
          padding: 11px 14px;
          color: white;
          background: linear-gradient(135deg, #6675ff 0%, #7a60ff 58%, #4f7cff 100%);
          box-shadow: 0 10px 24px rgba(97,113,255,0.2);
        }

        .smallSecondaryButton {
          border-radius: 14px;
          padding: 11px 14px;
          color: #30425c;
          background: #eef2f8;
        }

        @media (max-width: 1100px) {
          .hero {
            grid-template-columns: 1fr;
            gap: 28px;
            min-height: auto;
          }

          .heroLeft {
            padding-top: 22px;
            max-width: 100%;
          }

          .heroRight {
            justify-content: flex-start;
          }
        }

        @media (max-width: 768px) {
          .shell {
            padding: 18px 14px 40px;
          }

          .headline {
            font-size: clamp(40px, 12vw, 58px);
          }

          .subtext {
            font-size: 17px;
          }

          .heroActions {
            align-items: flex-start;
          }

          .phoneWrap {
            max-width: 100%;
          }

          .miniApp {
            min-height: 640px;
          }

          .heroNote {
            max-width: none;
          }
        }
      `}</style>
    </>
  );
}
