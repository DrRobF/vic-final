// The old Educator Dashboard is now split into My Week (/teach), My Lessons, My Classes and the School dashboard.
// Old links keep working: a lesson link opens that lesson, everything else goes to the person's own home.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export default function EducatorRedirect() { return null }
export async function getServerSideProps({ query }) {
 const lesson = typeof query.lesson === 'string' && UUID.test(query.lesson) ? query.lesson : ''
 return { redirect: { destination: lesson ? `/lesson/print?id=${lesson}` : '/start', permanent: false } }
}
