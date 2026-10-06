export function getServerSideProps() {
  return { redirect: { destination: '/lessonplan/access', permanent: false } }
}

export default function SignupRedirect() {
  return null
}
