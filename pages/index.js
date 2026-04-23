import { useState } from "react";
import { useRouter } from "next/router";
import VICHeader from "../components/VICHeader";
import VICLogo from "../components/VICLogo";

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
        <main className="shell">
          <VICHeader currentPath="/" />
          <section className="hero">
            <div className="heroLeft">
              <div className="brandBlock">
                <div className="logoStage">
                  <VICLogo size={124} variant="hero" alt="VIC Logo" />
                </div>

                <div className="brandTextWrap">
                  <div className="brandName">VIC</div>
                  <div className="brandSub">Virtual Co-Teacher</div>
                </div>
              </div>

              <h1 className="headline">
                VIC teaches students step by step
                <span> like a real teacher.</span>
              </h1>

              <p className="subtext">
                Like having an extra teacher in the classroom—and a private teacher
                at home.
              </p>

              <div className="heroActions">
                <button className="primaryButton" onClick={openFullVIC}>
                  Open Full VIC
                </button>
                <a className="secondaryLink" href="/teacher">Teacher Portal</a>
              </div>
            </div>

            <div className="heroRight">
              <div className="previewWrap">
                <div className="phoneShell">
                  <div className="phoneTop">
                    <div className="phoneDot" />
                    <div className="phoneTitle">VIC Preview</div>
                  </div>

                  <div className="previewCard">
                    {!reply ? (
                      <form onSubmit={askVIC} className="askForm">
                        <label className="inputLabel" htmlFor="vic-question">
                          Try VIC like a student would
                        </label>

                        <p className="previewHelper">
                          VIC will guide you step by step, not just give an answer.
                        </p>

                        <textarea
                          id="vic-question"
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          placeholder="Ask for help, start a lesson, or try a skill…"
                          rows={4}
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
          color: var(--vic-text-secondary);
        }

        * {
          box-sizing: border-box;
        }

        body {
          overflow-x: hidden;
          background: var(--vic-bg);
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

        .shell {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1240px;
          margin: 0 auto;
          padding: 24px 28px 36px;
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 400px;
          gap: 34px;
          align-items: start;
          min-height: calc(100vh - 132px);
        }

        .heroLeft {
          padding-top: 8px;
          max-width: 680px;
        }

        .brandBlock {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .logoStage {
          width: 132px;
          height: 132px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .brandTextWrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .brandName {
          font-size: 36px;
          font-weight: 900;
          letter-spacing: 0.02em;
          line-height: 1;
          color: var(--vic-text-secondary);
        }

        .brandSub {
          font-size: 13px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--vic-text-secondary);
        }

        .headline {
          margin: 0;
          font-size: clamp(48px, 5.3vw, 74px);
          line-height: 1;
          letter-spacing: -0.045em;
          font-weight: 900;
          max-width: 700px;
        }

        .headline span {
          display: block;
          color: var(--vic-text-primary);
        }

        .subtext {
          max-width: 560px;
          margin: 14px 0 0;
          font-size: 18px;
          line-height: 1.5;
          color: var(--vic-text-secondary);
        }

        .heroActions {
          margin-top: 18px;
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
          background: var(--vic-primary);
          box-shadow: 0 14px 30px rgba(150, 69, 40, 0.34);
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
          color: var(--vic-text-secondary);
          border: 1px solid var(--vic-border);
          background: var(--vic-surface-muted);
          text-decoration: none;
          font-size: 13px;
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
          max-width: 400px;
        }

        .phoneShell {
          position: relative;
          z-index: 2;
          border-radius: 24px;
          padding: 12px;
          background: linear-gradient(180deg, var(--vic-surface) 0%, var(--vic-surface-muted) 100%);
          border: 1px solid var(--vic-border);
          box-shadow: var(--vic-shadow-raised);
        }

        .phoneTop {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px 10px;
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
          color: var(--vic-text-secondary);
        }

        .previewCard {
          border-radius: 16px;
          overflow: hidden;
          background: var(--vic-surface);
          color: var(--vic-text-secondary);
          min-height: 470px;
          display: flex;
          flex-direction: column;
        }

        .askForm,
        .responseView {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-height: 470px;
        }

        .inputLabel {
          font-size: 18px;
          font-weight: 900;
          color: var(--vic-text-secondary);
        }

        .previewHelper {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          color: var(--vic-text-secondary);
        }

        .askForm textarea {
          width: 100%;
          border: 1px solid var(--vic-border);
          border-radius: 12px;
          outline: none;
          resize: none;
          background: var(--vic-surface);
          color: var(--vic-text-secondary);
          font-size: 15px;
          line-height: 1.55;
          min-height: 130px;
          padding: 13px;
        }

        .askForm textarea::placeholder {
          color: var(--vic-text-secondary);
        }

        .askButton {
          border-radius: 10px;
          padding: 13px 16px;
          color: var(--vic-surface);
          background: var(--vic-primary);
          box-shadow: 0 12px 26px rgba(150,69,40,0.28);
          margin-top: auto;
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
          border: 1px solid var(--vic-border);
          color: var(--vic-text-secondary);
        }

        .userBubble .bubbleLabel {
          color: var(--vic-text-secondary);
        }

        .vicBubble {
          background: linear-gradient(135deg, var(--vic-primary-soft) 0%, var(--vic-primary-soft) 100%);
          border: 1px solid var(--vic-border);
          color: var(--vic-text-secondary);
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
          margin-top: 24px;
          text-align: center;
          font-size: 13px;
          color: var(--vic-text-muted);
          padding-bottom: 8px;
        }

        @media (max-width: 1100px) {
          .hero {
            grid-template-columns: 1fr;
            gap: 24px;
            min-height: auto;
          }

          .heroRight {
            justify-content: center;
          }

          .previewWrap {
            max-width: 400px;
          }
        }

        @media (max-width: 768px) {
          .shell {
            padding: 20px 14px 34px;
          }

          .brandBlock {
            gap: 14px;
            margin-bottom: 14px;
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
            font-size: 17px;
          }

          .previewWrap {
            max-width: 100%;
          }

          .previewCard,
          .askForm,
          .responseView {
            min-height: 430px;
          }
        }
      `}</style>
    </>
  );
}
