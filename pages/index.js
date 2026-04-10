import { useState } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  async function askVIC(e) {
    e.preventDefault();
    if (!question.trim()) return;

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
                "You are VIC, a helpful teacher. Answer the student's question clearly and simply in 2–4 sentences. Do NOT ask follow-up questions. Do NOT ask for grade level. Just help them understand.",
            },
            {
              role: "user",
              content: question,
            },
          ],
        }),
      });

      const data = await res.json();
      setReply(data.reply);
    } catch (err) {
      setReply("Something went wrong.");
    }

    setLoading(false);
  }

  function openFull() {
    if (question.trim()) {
      router.push(`/askvic?starter=${encodeURIComponent(question)}`);
    } else {
      router.push("/askvic");
    }
  }

  return (
    <>
      <div className="page">
        <main className="container">

          {/* 🔥 BIG LOGO */}
          <div className="logoWrap">
            <img src="/vic-logo.png" className="logo" />
          </div>

          <div className="content">

            {/* LEFT */}
            <div className="left">
              <h1>
                VIC helps students
                <br />
                think things through.
              </h1>

              <p>
                Ask a real question. Watch how VIC responds.
              </p>

              <button onClick={openFull} className="mainBtn">
                Open Full VIC
              </button>
            </div>

            {/* RIGHT */}
            <div className="right">

              <div className="card">

                {!reply ? (
                  <form onSubmit={askVIC}>
                    <textarea
                      placeholder="Ask VIC anything..."
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                    />

                    <button disabled={loading}>
                      {loading ? "Thinking..." : "Ask VIC"}
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="bubble user">{question}</div>
                    <div className="bubble vic">{reply}</div>

                    <button onClick={openFull} className="continue">
                      Continue in Full VIC
                    </button>
                  </>
                )}

              </div>

            </div>

          </div>

          <footer>
            © {new Date().getFullYear()} Dr. L Robert Furman
          </footer>

        </main>
      </div>

      <style jsx global>{`
        body {
          margin: 0;
          font-family: Arial;
          background: #050505;
          color: white;
        }

        .container {
          max-width: 1200px;
          margin: auto;
          padding: 40px 20px;
        }

        /* 🔥 BIG LOGO */
        .logoWrap {
          margin-bottom: 30px;
        }

        .logo {
          width: 120px;
        }

        .content {
          display: flex;
          gap: 40px;
        }

        .left {
          flex: 1;
        }

        h1 {
          font-size: 60px;
          line-height: 1;
        }

        p {
          opacity: 0.7;
          margin-top: 20px;
        }

        .mainBtn {
          margin-top: 30px;
          padding: 15px 25px;
          border-radius: 10px;
          border: none;
          background: #5b6cff;
          color: white;
          font-weight: bold;
        }

        .right {
          width: 350px;
        }

        .card {
          background: #f2f4f8;
          color: black;
          border-radius: 20px;
          padding: 20px;
        }

        textarea {
          width: 100%;
          height: 120px;
          border-radius: 10px;
          border: none;
          padding: 10px;
        }

        button {
          margin-top: 10px;
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          border: none;
          background: #5b6cff;
          color: white;
          font-weight: bold;
        }

        .bubble {
          padding: 10px;
          border-radius: 10px;
          margin-bottom: 10px;
        }

        .user {
          background: #ddd;
        }

        .vic {
          background: #cfd8ff;
        }

        .continue {
          margin-top: 15px;
          background: black;
        }

        footer {
          margin-top: 40px;
          opacity: 0.5;
          text-align: center;
        }
      `}</style>
    </>
  );
}
