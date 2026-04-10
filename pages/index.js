import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  return (
    <div style={styles.container}>
      
      <div style={styles.logo}>VIC</div>

      <h1 style={styles.headline}>
        Not a chatbot. A co-teacher.
      </h1>

      <p style={styles.subtext}>
        VIC helps students think, not just answer.
      </p>

      <button
        style={styles.button}
        onClick={() => router.push("/askvic")}
      >
        Talk to VIC
      </button>

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
    fontSize: "32px",
    marginBottom: "10px",
  },
  subtext: {
    fontSize: "18px",
    color: "#bbb",
    marginBottom: "40px",
  },
  button: {
    padding: "18px 36px",
    fontSize: "20px",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "#4f46e5",
    color: "white",
    cursor: "pointer",
    marginBottom: "30px",
  },
  footer: {
    fontSize: "14px",
    color: "#666",
  },
};
