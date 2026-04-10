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

  function useSuggestion(text) {
    setQuestion(text);
  }

  function goToFullVIC(e) {
    if (e) e.preventDefault();

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
          <div className="topBadge">Virtual Co-Teacher</div>

          <section className="hero">
            {/* LEFT SIDE */}
            <div className="heroLeft">
              <div className="eyebrow">Not another answer machine</div>

              <h1 className="headline">
                This doesn’t just answer questions.
                <span> It teaches students how to think.</span>
              </h1>

              <p className="subtext">
                Ask one real question on the right. VIC will take it from there.
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
              </div>
            </div>

            {/* RIGHT SIDE — MINI VIC */}
            <div className="heroRight">
              <div className="phoneWrap">
                <div className="phoneGlow" />

                <div className="phoneShell">
                  <div className="phoneTopBar">
                    <div className="phoneCam" />
                    <div className="phoneTitle">VIC</div>
                    <div className="phoneStatus">Start here</div>
                  </div>

                  <div className="miniApp">
                    <div className="miniHeader">
                      <img
                        src="/vic-logo.png"
                        alt="VIC Logo"
                        className="miniLogo"
                      />
                      <div>
                        <div className="miniHeaderTitle">
                          Ask VIC a question
                        </div>
                        <div className="miniHeaderSub">
                          This will open a full session
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
                      </div>

                      <form className="inputZone" onSubmit={goToFullVIC}>
                        <textarea
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          placeholder="Type your question..."
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
                            Ask VIC
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

          {/* FOOTER */}
          <footer className="footer">
            © {new Date().getFullYear()} Dr. L Robert Furman — All rights reserved
          </footer>
        </main>
      </div>

      <style jsx global>{`
        html, body, #__next {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100%;
          font-family: Inter, Arial, sans-serif;
          background: #040404;
          color: white;
        }

        * { box-sizing: border-box; }

        body {
          background:
            radial-gradient(circle at top left, rgba(74,101,255,0.1), transparent 24%),
            radial-gradient(circle at bottom right, rgba(103,72,255,0.08), transparent 26%),
            #040404;
        }

        .shell {
          max-width: 1300px;
          margin: auto;
          padding: 30px;
        }

        .hero {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }

        .headline {
          font-size: clamp(40px, 5vw, 70px);
          font-weight: 800;
          line-height: 1;
        }

        .headline span {
          display: block;
          opacity: 0.9;
        }

        .primaryButton {
          padding: 14px 22px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #6675ff, #7a60ff);
          color: white;
          cursor: pointer;
        }

        .phoneShell {
          border-radius: 30px;
          background: #111;
          padding: 12px;
        }

        .miniApp {
          background: #f5f7fb;
          color: black;
          border-radius: 20px;
          padding: 15px;
        }

        .inputZone textarea {
          width: 100%;
          border: none;
          outline: none;
          resize: none;
        }

        .smallPrimaryButton {
          background: #6675ff;
          color: white;
          padding: 10px 14px;
          border-radius: 10px;
          border: none;
        }

        .smallSecondaryButton {
          background: #ddd;
          padding: 10px 14px;
          border-radius: 10px;
          border: none;
        }

        .footer {
          margin-top: 60px;
          text-align: center;
          font-size: 13px;
          color: rgba(255,255,255,0.4);
        }
      `}</style>
    </>
  );
}
