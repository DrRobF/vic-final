export default function AboutVIC() {
  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlowOne} />
      <div style={styles.backgroundGlowTwo} />
      <div style={styles.backgroundGlowThree} />

      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.eyebrow}>The Story Behind VIC</div>

          <h1 style={styles.title}>About VIC</h1>

          <p style={styles.lead}>
            VIC stands for <strong>Virtual Co-Teacher</strong>. It was built to do
            something simple: actually teach. Not just give answers, but guide,
            explain, and help people understand.
          </p>

          <p style={styles.text}>The idea behind VIC started long before AI.</p>

          <p style={styles.text}>
            My dad created his own version of something like this years ago.
            People would send him questions, and he would route them to experts,
            research the answers, and respond with thoughtful explanations. He
            had systems, stock responses, and ways of organizing knowledge long
            before tools like this existed.
          </p>

          <p style={styles.text}>
            In a very real way, he was doing by hand what AI is only now
            beginning to do at scale.
          </p>

          <p style={styles.text}>
            VIC is my way of carrying that idea forward — bringing real teaching
            into a modern tool.
          </p>

          <p style={styles.text}>
            I’ve spent my career in education as a principal, teacher, and school
            leader. VIC is being built from that experience, with the goal of
            making learning feel more personal, more guided, and more human.
          </p>

          <p style={styles.text}>
            At its heart, VIC is about helping people feel what every good teacher
            hopes for: <em>“Ohhh… now I get it.”</em>
          </p>

          <div style={styles.backWrap}>
            <a href="/askvic" style={styles.backLink}>
              ← Back to VIC
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
    background:
      'radial-gradient(circle at 18% 10%, rgba(171, 91, 255, 0.28), transparent 24%), radial-gradient(circle at 82% 82%, rgba(84, 248, 255, 0.10), transparent 24%), linear-gradient(135deg, #070312 0%, #17092b 50%, #10061d 100%)',
    color: '#f5eeff',
    padding: '48px 20px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif',
  },

  backgroundGlowOne: {
    position: 'absolute',
    top: '-100px',
    left: '-80px',
    width: '280px',
    height: '280px',
    background: 'rgba(171, 91, 255, 0.22)',
    filter: 'blur(90px)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },

  backgroundGlowTwo: {
    position: 'absolute',
    bottom: '-120px',
    right: '-80px',
    width: '300px',
    height: '300px',
    background: 'rgba(214, 104, 255, 0.18)',
    filter: 'blur(95px)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },

  backgroundGlowThree: {
    position: 'absolute',
    top: '35%',
    left: '70%',
    width: '220px',
    height: '220px',
    background: 'rgba(84, 248, 255, 0.08)',
    filter: 'blur(80px)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },

  container: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '860px',
    margin: '0 auto',
  },

  card: {
    background: 'linear-gradient(180deg, rgba(18, 8, 38, 0.90) 0%, rgba(10, 14, 31, 0.86) 100%)',
    border: '1px solid rgba(191, 141, 255, 0.18)',
    borderRadius: '28px',
    padding: '36px 32px',
    boxShadow:
      '0 24px 60px rgba(0,0,0,0.30), 0 0 30px rgba(171,91,255,0.10), inset 0 1px 0 rgba(255,255,255,0.05)',
    backdropFilter: 'blur(16px)',
  },

  eyebrow: {
    fontSize: '12px',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: '#c5a7ff',
    fontWeight: 800,
    marginBottom: '12px',
  },

  title: {
    fontSize: '42px',
    lineHeight: 1.0,
    letterSpacing: '-0.03em',
    margin: '0 0 22px 0',
    color: '#fbf7ff',
    fontWeight: 700,
    textShadow: '0 0 20px rgba(171,91,255,0.12)',
    fontFamily:
      '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
  },

  lead: {
    fontSize: '19px',
    lineHeight: 1.75,
    color: '#f2eaff',
    margin: '0 0 22px 0',
  },

  text: {
    fontSize: '17px',
    lineHeight: 1.85,
    color: '#e2d6ff',
    margin: '0 0 18px 0',
  },

  backWrap: {
    marginTop: '34px',
  },

  backLink: {
    display: 'inline-block',
    textDecoration: 'none',
    color: '#f9f3ff',
    fontWeight: 700,
    fontSize: '15px',
    padding: '12px 16px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, rgba(171,91,255,0.22), rgba(84,248,255,0.10))',
    border: '1px solid rgba(206, 170, 255, 0.24)',
    boxShadow: '0 0 22px rgba(171,91,255,0.12)',
  },
}
