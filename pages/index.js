import { useMemo, useState } from "react";
import { useRouter } from "next/router";

const PREVIEW_API_ENDPOINT = "/api/askvic-preview";

const SUGGESTIONS = [
  "Why do we flip fractions?",
  "What is the difference between area and perimeter?",
  "Can you help me solve 3x + 5 = 17?",
  "Why does dividing by 1/2 make the number bigger?"
];

export default function Home() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [previewAnswer, setPreviewAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasUsedPreview, setHasUsedPreview] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return question.trim().length > 0 && !isLoading && !hasUsedPreview;
  }, [question, isLoading, hasUsedPreview]);

  async function handlePreviewSubmit(e) {
    e.preventDefault();

    if (!canSubmit) return;

    const trimmed = question.trim();
    setIsLoading(true);
    setError("");
    setSubmittedQuestion(trimmed);
    setPreviewAnswer("");

    try {
      const response = await fetch(PREVIEW_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: trimmed,
          preview: true,
          mode: "landing-preview"
        })
      });

      if (!response.ok) {
        throw new Error(`Preview request failed with status ${response.status}`);
      }

      const data = await response.json();

      const answer =
        data?.answer ||
        data?.message ||
        data?.reply ||
        data?.output ||
        "";

      if (!answer || typeof answer !== "string") {
        throw new Error("Preview API returned no usable answer.");
      }

      setPreviewAnswer(answer.trim());
      setHasUsedPreview(true);
    } catch (err) {
      console.error(err);
      setError(
        "The preview box is ready, but the VIC preview endpoint is not connected yet. Point PREVIEW_API_ENDPOINT to the same backend route your /askvic page uses."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSuggestionClick(text) {
    if (hasUsedPreview || isLoading) return;
    setQuestion(text);
  }

  function openFullVIC() {
    const starter = (submittedQuestion || question).trim();

    if (starter) {
      router.push(`/askvic?starter=${encodeURIComponent(starter)}`);
      return;
    }

    router.push("/askvic");
  }

  return (
    <>
      <div className="page">
        <div className="ambient ambientLeft" />
        <div className="ambient ambientRight" />
        <div className="gridFade" />

        <main className="shell">
          <section className="hero">
            <div className="topBadge">Virtual Co-Teacher</div>

            <div className="heroGrid">
              <div className="heroCopy">
                <div className="eyebrow">Not another answer machine</div>

                <h1 className="headline">
                  This doesn’t just answer questions.
                  <span> It teaches students how to think.</span>
                </h1>

                <p className="subtext">
                  A calm first look at VIC. Ask one real question below and feel
                  the difference before stepping into the full experience.
                </p>

                <div className="quietProof">
                  <span>Guides thinking</span>
                  <span>Checks understanding</span>
                  <span>Hints, not shortcuts</span>
                </div>
              </div>

              <div className="heroVisual">
                <div className="logoStage">
                  <div className="logoHalo" />
                  <div className="logoRing ringOne" />
                  <div className="logoRing ringTwo" />
                  <img src="/vic-logo.png" alt="VIC Logo" className="vicLogo" />
                </div>

                <div className="floatingCard floatingCardTop">
                  <div className="floatingLabel">Student moment</div>
                  Wait… why do we flip the fraction?
                </div>

                <div className="floatingCard floatingCardBottom">
                  <div className="floatingLabel">VIC response</div>
                  Before we flip it, what does dividing mean here?
                </div>
              </div>
            </div>
          </section>

          <section className="previewSection">
            <div className="previewIntro">
              <div className="sectionKicker">One-question preview</div>
              <h2 className="sectionTitle">Try one moment with VIC</h2>
              <p className="sectionCopy">
                Ask a real question. VIC answers once here. Then, if you want to
                keep going, step into the full portal.
              </p>
            </div>

            <div className="previewCard">
              <div className="previewHeader">
                <div>
                  <div className="previewEyebrow">Preview window</div>
                  <div className="previewTitle">Ask VIC one question</div>
                </div>

                <div className="previewStatus">
                  <span className="statusDot" />
                  {hasUsedPreview ? "Preview used" : "One response available"}
                </div>
              </div>

              <form onSubmit={handlePreviewSubmit} className="previewForm">
                <label htmlFor="vic-preview" className="srOnly">
                  Ask VIC a question
                </label>

                <textarea
                  id="vic-preview"
                  className="previewInput"
                  placeholder="Type a question for VIC..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={hasUsedPreview || isLoading}
                  rows={4}
                />

                <div className="suggestionRow">
                  {SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="suggestionChip"
                      onClick={() => handleSuggestionClick(item)}
                      disabled={hasUsedPreview || isLoading}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="previewActions">
                  <button
                    type="submit"
                    className="primaryButton"
                    disabled={!canSubmit}
                  >
                    {isLoading ? "VIC is thinking..." : "Ask VIC"}
                  </button>

                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={openFullVIC}
                  >
                    Go to full VIC
                  </button>
                </div>
              </form>

              {error ? (
                <div className="errorBox">{error}</div>
              ) : null}

              {submittedQuestion ? (
                <div className="conversation">
                  <div className="message student">
                    <div className="messageLabel">Student</div>
                    <p>{submittedQuestion}</p>
                  </div>

                  {isLoading ? (
                    <div className="message vic typing">
                      <div className="messageLabel">VIC</div>
                      <p>Thinking through it carefully...</p>
                    </div>
                  ) : null}

                  {!isLoading && previewAnswer ? (
                    <>
                      <div className="message vic highlight">
                        <div className="messageLabel">VIC</div>
                        <p>{previewAnswer}</p>
                      </div>

                      <div className="continueCard">
                        <div className="continueKicker">
                          Want to keep going?
                        </div>
                        <h3 className="continueTitle">
                          Step into the full VIC experience
                        </h3>
                        <p className="continueCopy">
                          This preview gives one answer. The full portal lets VIC
                          stay with the student, guide step-by-step, and keep
                          teaching through the moment.
                        </p>

                        <button
                          type="button"
                          className="primaryButton large"
                          onClick={openFullVIC}
                        >
                          Start a full session
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
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
          filter: blur(90px);
          pointer-events: none;
          opacity: 0.85;
        }

        .ambientLeft {
          width: 420px;
          height: 420px;
          left: -120px;
          top: 80px;
          background: rgba(73, 100, 255, 0.14);
        }

        .ambientRight {
          width: 380px;
          height: 380px;
          right: -120px;
          bottom: 140px;
          background: rgba(100, 72, 255, 0.12);
        }

        .gridFade {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px);
          background-size: 46px 46px;
          mask-image: linear-gradient(180deg, rgba(255,255,255,0.28), transparent 78%);
          pointer-events: none;
        }

        .shell {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1220px;
          margin: 0 auto;
          padding: 30px 20px 72px;
        }

        .hero {
          padding: 10px 0 26px;
        }

        .topBadge {
          width: fit-content;
          margin: 0 auto 26px;
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

        .heroGrid {
          display: grid;
          grid-template-columns: 1.02fr 0.98fr;
          gap: 34px;
          align-items: center;
          min-height: 540px;
        }

        .heroCopy {
          padding-right: 12px;
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
          max-width: 740px;
          font-size: clamp(42px, 6vw, 82px);
          line-height: 0.96;
          letter-spacing: -0.065em;
          font-weight: 800;
        }

        .headline span {
          display: block;
          color: rgba(255,255,255,0.9);
        }

        .subtext {
          max-width: 640px;
          margin: 24px 0 0;
          font-size: 20px;
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

        .heroVisual {
          position: relative;
          min-height: 520px;
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
          width: 380px;
          height: 380px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(116, 130, 255, 0.22) 0%,
            rgba(116, 130, 255, 0.1) 42%,
            rgba(116, 130, 255, 0.03) 62%,
            transparent 75%
          );
          filter: blur(30px);
        }

        .logoRing {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.06);
        }

        .ringOne {
          width: 310px;
          height: 310px;
        }

        .ringTwo {
          width: 390px;
          height: 390px;
          opacity: 0.35;
        }

        .vicLogo {
          position: relative;
          z-index: 2;
          width: min(330px, 70vw);
          height: auto;
          filter: drop-shadow(0 0 28px rgba(118, 128, 255, 0.32));
        }

        .floatingCard {
          position: absolute;
          z-index: 3;
          max-width: 250px;
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(10, 10, 18, 0.72);
          backdrop-filter: blur(12px);
          box-shadow: 0 18px 40px rgba(0,0,0,0.28);
          color: rgba(255,255,255,0.88);
          line-height: 1.45;
          font-size: 15px;
        }

        .floatingCardTop {
          top: 78px;
          right: 0;
          transform: rotate(3deg);
        }

        .floatingCardBottom {
          bottom: 76px;
          left: 8px;
          transform: rotate(-4deg);
        }

        .floatingLabel {
          margin-bottom: 8px;
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #a7b3ff;
        }

        .previewSection {
          margin-top: 10px;
        }

        .previewIntro {
          max-width: 760px;
          margin-bottom: 22px;
        }

        .sectionKicker {
          margin-bottom: 10px;
          font-size: 12px;
          letter-spacing: 0.17em;
          text-transform: uppercase;
          color: #8fa2ff;
        }

        .sectionTitle {
          margin: 0;
          font-size: clamp(34px, 4.5vw, 58px);
          line-height: 1.02;
          letter-spacing: -0.05em;
          font-weight: 800;
        }

        .sectionCopy {
          max-width: 730px;
          margin: 16px 0 0;
          font-size: 19px;
          line-height: 1.7;
          color: rgba(255,255,255,0.66);
        }

        .previewCard {
          position: relative;
          padding: 24px;
          border-radius: 28px;
          border: 1px solid rgba(255,255,255,0.08);
          background:
            radial-gradient(circle at top right, rgba(74, 99, 255, 0.09), transparent 28%),
            linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.03));
          backdrop-filter: blur(12px);
          box-shadow:
            0 24px 70px rgba(0,0,0,0.34),
            inset 0 1px 0 rgba(255,255,255,0.03);
        }

        .previewHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .previewEyebrow {
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(167, 179, 255, 0.8);
        }

        .previewTitle {
          margin-top: 6px;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: white;
        }

        .previewStatus {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.76);
          font-size: 13px;
        }

        .statusDot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #90a0ff;
          box-shadow: 0 0 12px rgba(144,160,255,0.9);
        }

        .previewForm {
          display: block;
        }

        .previewInput {
          width: 100%;
          min-height: 112px;
          resize: vertical;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          background: rgba(255,255,255,0.035);
          color: white;
          padding: 18px 18px;
          outline: none;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
          transition: border-color 0.16s ease, box-shadow 0.16s ease;
        }

        .previewInput::placeholder {
          color: rgba(255,255,255,0.38);
        }

        .previewInput:focus {
          border-color: rgba(139, 157, 255, 0.34);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.03),
            0 0 0 4px rgba(93, 110, 255, 0.08);
        }

        .previewInput:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .suggestionRow {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 14px;
        }

        .suggestionChip {
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.035);
          color: rgba(255,255,255,0.76);
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease, opacity 0.15s ease;
        }

        .suggestionChip:hover:enabled {
          transform: translateY(-1px);
          background: rgba(255,255,255,0.055);
        }

        .suggestionChip:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .previewActions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .primaryButton,
        .secondaryButton {
          border: none;
          border-radius: 18px;
          padding: 16px 24px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
        }

        .primaryButton {
          color: white;
          background: linear-gradient(135deg, #6675ff 0%, #7a60ff 58%, #4f7cff 100%);
          box-shadow: 0 16px 44px rgba(97,113,255,0.32);
        }

        .primaryButton:hover:enabled {
          transform: translateY(-2px);
          box-shadow: 0 22px 56px rgba(97,113,255,0.45);
        }

        .primaryButton:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .primaryButton.large {
          min-width: 230px;
          padding: 18px 28px;
          font-size: 18px;
        }

        .secondaryButton {
          color: rgba(255,255,255,0.88);
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .secondaryButton:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,0.08);
        }

        .errorBox {
          margin-top: 18px;
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid rgba(255,120,120,0.16);
          background: rgba(255,90,90,0.08);
          color: rgba(255,220,220,0.9);
          line-height: 1.55;
        }

        .conversation {
          margin-top: 24px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .message {
          max-width: 84%;
          padding: 16px 18px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: 0 12px 28px rgba(0,0,0,0.18);
        }

        .message p {
          margin: 0;
          line-height: 1.7;
          font-size: 17px;
          color: rgba(255,255,255,0.92);
          white-space: pre-wrap;
        }

        .messageLabel {
          margin-bottom: 8px;
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.56);
        }

        .message.student {
          align-self: flex-start;
          background: rgba(255,255,255,0.05);
        }

        .message.vic {
          align-self: flex-end;
          background: rgba(92, 109, 255, 0.12);
        }

        .message.highlight {
          background: linear-gradient(135deg, rgba(96,112,255,0.17), rgba(120,97,255,0.15));
          border-color: rgba(156, 172, 255, 0.16);
        }

        .message.typing {
          opacity: 0.88;
        }

        .continueCard {
          margin-top: 10px;
          padding: 22px;
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,0.08);
          background:
            radial-gradient(circle at top left, rgba(82, 101, 255, 0.08), transparent 28%),
            rgba(255,255,255,0.035);
        }

        .continueKicker {
          margin-bottom: 8px;
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #9eb0ff;
        }

        .continueTitle {
          margin: 0;
          font-size: clamp(24px, 3vw, 38px);
          line-height: 1.05;
          letter-spacing: -0.04em;
        }

        .continueCopy {
          max-width: 760px;
          margin: 14px 0 0;
          color: rgba(255,255,255,0.7);
          line-height: 1.7;
          font-size: 17px;
        }

        .srOnly {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          border: 0;
        }

        @media (max-width: 980px) {
          .heroGrid {
            grid-template-columns: 1fr;
            gap: 24px;
            min-height: auto;
          }

          .heroCopy {
            padding-right: 0;
          }

          .heroVisual {
            min-height: 420px;
          }

          .logoStage {
            height: 420px;
          }
        }

        @media (max-width: 768px) {
          .shell {
            padding: 18px 14px 54px;
          }

          .headline {
            font-size: clamp(38px, 12vw, 58px);
          }

          .subtext,
          .sectionCopy,
          .continueCopy {
            font-size: 16px;
          }

          .heroVisual {
            display: block;
            min-height: auto;
          }

          .logoStage {
            height: 340px;
          }

          .logoHalo {
            width: 280px;
            height: 280px;
          }

          .ringOne {
            width: 220px;
            height: 220px;
          }

          .ringTwo {
            width: 280px;
            height: 280px;
          }

          .vicLogo {
            width: min(220px, 62vw);
          }

          .floatingCard {
            position: static;
            transform: none !important;
            max-width: 100%;
            margin-top: 12px;
          }

          .previewCard {
            padding: 18px;
            border-radius: 22px;
          }

          .previewTitle {
            font-size: 24px;
          }

          .previewActions {
            flex-direction: column;
          }

          .primaryButton,
          .secondaryButton,
          .primaryButton.large {
            width: 100%;
          }

          .message {
            max-width: 100%;
          }
        }
      `}</style>
    </>
  );
}
