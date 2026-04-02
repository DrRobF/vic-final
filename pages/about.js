export default function AboutVIC() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>About VIC</h1>

        <p style={styles.text}>
          VIC stands for Virtual Co-Teacher. It was built to do something simple:
          actually teach. Not just give answers, but guide, explain, and help
          people understand.
        </p>

        <p style={styles.text}>
          The idea behind VIC started long before AI.
        </p>

        <p style={styles.text}>
          My dad created his own version of something like this years ago. People
          would send him questions, and he would route them to experts, research
          the answers, and respond with thoughtful explanations. He had systems,
          stock responses, and ways of organizing knowledge long before tools like
          this existed.
        </p>

        <p style={styles.text}>
          He was doing, in a human way, what AI is only now starting to do at
          scale.
        </p>

        <p style={styles.text}>
          VIC is my way of carrying that idea forward — bringing real teaching into
          a modern tool.
        </p>

        <p style={styles.text}>
          I’ve spent my career in education as a principal, teacher, and school
          leader. VIC is being built from that experience, with the goal of making
          learning feel more personal, more guided, and more human.
        </p>
      </div>
    </div>
  )
}
<a href="/askvic" style={{ color: '#cba6ff', fontWeight: 600 }}>
  ← Back to VIC
</a>
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #070312 0%, #17092b 50%, #10061d 100%)',
    color: '#f3edff',
    padding: '40px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    maxWidth: '760px',
    margin: '0 auto',
    lineHeight: 1.7,
  },
  title: {
    fontSize: '34px',
    marginBottom: '22px',
  },
  text: {
    fontSize: '17px',
    marginBottom: '16px',
  },
}
