export default function TeacherRedirect() { return null }

export async function getServerSideProps() {
  return { redirect: { destination: '/educator#classrooms', permanent: false } }
}
