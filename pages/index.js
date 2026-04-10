import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  return (
    <div style={styles.container}>
      
      <div style={styles.logo}>VIC</div>

      <h1 style={styles.headline}>
        Most AI gives answers. VIC teaches you how to think.
      </h1>

      <p style={styles.subtext}>
        A co-teacher that guides, checks, and adapts to every student.
      </p>

      <button
        style={styles.button}
        onClick={() => router.push("/askvic")}
      >
        Talk to VIC
      </button>

      <div style={styles.features}>
        <p>✓ Guides step-by-step</p>
        <p>✓ Checks your thinking</p>
        <p>✓ Adapts to how you learn</p>
      </div>

      <p style={styles.try}>
        Try asking: “Help me solve 3/4 ÷ 1/2 step by step”
      </p>

      <p style={styles.footer}>
        For students, parents, and teachers
      </p>

    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    backgroundColor: "#0a0a0a",
    color: "white",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "system-ui, sans-serif",
    textAlign: "center",
    padding: "20px",
  },
  logo: {
    fontSize: "72px",
    fontWeight: "800",
    letterSpacing: "8px",
    marginBottom: "20px",
  },
  headline: {
    fontSize: "34px",
    maxWidth: "700px",
    marginBottom: "15px",
    lineHeight: "1.3",
  },
  subtext: {
    fontSize: "18px",
    color: "#bbb",
    marginBottom: "35px",
    maxWidth: "600px",
  },
  button: {
    padding: "18px 40px",
    fontSize: "20px",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg, #4f46e5, #6366f1)",
    color: "white",
    cursor: "pointer",
    marginBottom: "30px",
    boxShadow: "0 10px 25px rgba(79,70,229,0.4)",
  },
  features: {
    marginTop: "10px",
    color: "#bbb",
    fontSize: "16px",
    lineHeight: "1.8",
  },
  try: {
    marginTop: "20px",
    fontSize: "14px",
    color: "#888",
    fontStyle: "italic",
  },
  footer: {
    marginTop: "30px",
    fontSize: "14px",
    color: "#666",
  },
};
