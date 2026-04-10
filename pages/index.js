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

  function launchVIC(e) {
    if (e) e.preventDefault();

    const trimmed = question.trim();

    if (trimmed) {
      router.push(`/askvic?starter=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/askvic");
    }
  }

  function useSuggestion(text) {
    setQuestion(text);
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
                Start with a real question. VIC takes it from there.
              </p>

              <div className="quietProof">
                <span>Guides thinking</span>
                <span>Checks understanding</span>
                <span>Hints, not shortcuts</span>
              </div>

              <div className="heroActions">
                <button className="primaryButton" onClick={launchVIC}>
                  Open Full VIC
                </button>
              </div>
            </div>

            <div className="heroRight">
              <div className="phoneWrap">
                <div className="phoneGlow" />

                <div className="phoneShell">
                  <div className="phoneTopBar">
                    <div className="phoneCam" />
                    <div className="phoneTitle">VIC</div>
                    <div className="phoneStatus">Launch</div>
                  </div>

                  <div className="miniApp">
                    <div className="miniHeader">
                      <img
                        src="/vic-logo.png"
                        alt="VIC Logo"
                        className="miniLogo"
                      />
                      <div className="miniHeaderText">
                        <div className="miniHeaderTitle">Start with a question</div>
                        <div className="miniHeaderSub">
                          Your question opens a real VIC session
                        </div>
                      </div>
                    </div>

                    <div className="miniWorkspace">
                      <div className="workspaceTabs">
                        <span className="tab active">Chat</span>
                        <span className="tab">Practice</span>
                        <span className="tab">Sketch</span>
                      </div>

                      <form className="launcherCard" onSubmit={launchVIC}>
                        <label className="inputLabel" htmlFor="vic-question">
                          Ask VIC something
                        </label>

                        <textarea
                          id="vic-question"
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          placeholder="Type your question here..."
                          rows={6}
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

                        <button type="submit" className="launchButton">
                          Ask VIC
                        </button>
                      </form>
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
          mask-image: linear-gradient(180deg, rgba(255,255,255,0.24), transparent 78%);
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

        .topBadge {
          width: fit-content;
          margin: 0 auto 20px;
          padding: 10px 16px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.8);
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          backdrop-filter: blur(10px);
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 420px);
          gap: 48px;
          align-items: start;
          min-height: calc(100vh - 120px);
        }

        .heroLeft {
          padding-top: 54px;
          max-width: 720px;
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
          font-size: clamp(44px, 6vw, 78px);
          line-height: 0.96;
          letter-spacing: -0.065em;
          font-weight: 800;
          max-width: 680px;
        }

        .headline span {
          display: block;
          color: rgba(255,255,255,0.92);
        }

        .subtext {
          max-width: 580px;
          margin: 24px 0 0;
          font-size: 20px;
          line-height: 1.65;
          color: rgba(255,255,255,0.7);
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
          color: rgba(255,255,255,0.78);
          font-size: 14px;
        }

        .heroActions {
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
          margin-top: 30px;
        }

        .primaryButton,
        .launchButton {
          border: none;
          cursor: pointer;
          font-weight: 800;
          transition: transform 0.16s ease, box-shadow 0.16s ease;
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
        .suggestionChip:hover {
          transform: translateY(-1px);
        }

        .heroRight {
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
          padding-top: 6px;
        }

        .phoneWrap {
          position: relative;
          width: 100%;
          max-width: 380px;
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

        .phoneTopBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 10px 14px;
          color: rgba(255,255,255,0.76);
          font-size: 13px;
        }

        .phoneCam {
          width: 42px;
          height: 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.12);
          flex-shrink: 0;
        }

        .phoneTitle {
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .phoneStatus {
          color: #9db0ff;
          font-size: 12px;
          white-space: nowrap;
        }

        .miniApp {
          border-radius: 28px;
          overflow: hidden;
          background: #f5f7fb;
          color: #101418;
          height: 620px;
          display: flex;
          flex-direction: column;
        }

        .miniHeader {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 16px 14px;
          background: white;
          border-bottom: 1px solid #e8edf5;
        }

        .miniLogo {
          width: 36px;
          height: 36px;
          object-fit: contain;
          border-radius: 10px;
          background: #eff3ff;
          padding: 5px;
          flex-shrink: 0;
        }

        .miniHeaderText {
          min-width: 0;
        }

        .miniHeaderTitle {
          font-size: 18px;
          font-weight: 800;
          color: #0f1720;
          line-height: 1.2;
        }

        .miniHeaderSub {
          margin-top: 4px;
          font-size: 13px;
          color: #68768a;
          line-height: 1.35;
        }

        .miniWorkspace {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 12px;
          gap: 10px;
        }

        .workspaceTabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .tab {
          padding: 7px 12px;
          border-radius: 999px;
          background: #e9eef8;
          color: #55657c;
          font-size: 12px;
          font-weight: 700;
        }

        .tab.active {
          background: #dfe7ff;
          color: #3251d2;
        }

        .launcherCard {
          flex: 1;
          background: white;
          border: 1px solid #e6ebf2;
          border-radius: 18px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .inputLabel {
          font-size: 13px;
          font-weight: 700;
          color: #516178;
        }

        .launcherCard textarea {
          width: 100%;
          border: 1px solid #e6ebf2;
          border-radius: 14px;
          outline: none;
          resize: none;
          background: #fbfcfe;
          color: #17212b;
          font-size: 15px;
          line-height: 1.55;
          min-height: 130px;
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
          background: #eef2f8;
          color: #4d5f79;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 12px;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .suggestionChip:hover {
          background: #e4ebf8;
        }

        .launchButton {
          border-radius: 14px;
          padding: 14px 16px;
          color: white;
          background: linear-gradient(135deg, #6675ff 0%, #7a60ff 58%, #4f7cff 100%);
          box-shadow: 0 10px 24px rgba(97,113,255,0.22);
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
            gap: 28px;
            min-height: auto;
          }

          .heroLeft {
            padding-top: 20px;
            max-width: 100%;
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

          .headline {
            font-size: clamp(38px, 11vw, 58px);
          }

          .subtext {
            font-size: 17px;
          }

          .phoneWrap {
            max-width: 100%;
          }

          .miniApp {
            height: 600px;
          }
        }
      `}</style>
    </>
  );
}
