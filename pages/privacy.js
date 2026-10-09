import LegalPage,{CONTACT_EMAIL} from '../components/LegalPage'

const mail=<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

export default function Privacy(){
 return <LegalPage title="Privacy Policy" description="How Ask VIC collects, uses, protects, and deletes educator, staff, and student information, including our commitments under FERPA, COPPA, and Florida student privacy law."
  summary={<>
   <p><strong>The short version.</strong> Ask VIC is built by a principal for educators. We treat the information you trust us with the way a good school treats its records.</p>
   <ul>
    <li>We collect only what Ask VIC needs to work.</li>
    <li><strong>We never sell personal information, never show ads, and never use student information to build marketing profiles.</strong></li>
    <li>Your lessons, notes, and drafts are private to your account.</li>
    <li>Student information exists only when a school or teacher sets up a classroom, and it is used only for that school’s educational purposes, under the school’s control.</li>
    <li>Our AI provider does not use your content to train its models.</li>
    <li>You can ask us to delete your information at any time.</li>
   </ul>
  </>}>

  <h2>1. Who we are</h2>
  <p>Ask VIC (“VIC,” “we,” “us”) at askvic.ai is operated by Dr. L. Robert Furman. Questions, requests, and concerns go to {mail}.</p>

  <h2>2. Who this policy covers</h2>
  <ul>
   <li><strong>Educators</strong> who create a free account (teachers, coaches, and school leaders).</li>
   <li><strong>School leaders and their staff</strong> who use the school leadership workspace, walkthroughs, and Learning Paths.</li>
   <li><strong>Students</strong> whose accounts are created and managed by their school or teacher. Students cannot sign up for Ask VIC on their own.</li>
   <li><strong>Families</strong>, whose contact email a teacher may save to send letters.</li>
  </ul>

  <h2>3. What we collect</h2>
  <table><thead><tr><th>Information</th><th>Examples</th><th>Why</th></tr></thead><tbody>
   <tr><td>Educator account</td><td>Email, name, role, sign-in records, your signup choices (agreement to these terms, and your Yes or No to email updates, with the date)</td><td>To create and secure your account and honor your choices</td></tr>
   <tr><td>Your work</td><td>Lessons and uploads, assistant notes and task lists, parent and class letter drafts, Learning Paths (topics, quiz answers, reflections)</td><td>To save your work and generate what you ask for</td></tr>
   <tr><td>School leadership</td><td>School name, staff list (names, roles, assignments, emails), weekly commitments, walkthrough records (ratings, strengths, next steps, private administrative notes), assigned Learning Paths, the school join code</td><td>To run the school leadership tools a school chooses to use</td></tr>
   <tr><td>Students (school-managed only)</td><td>Name, school login, class enrollment, optional parent email, optional interests the teacher adds, conversations with VIC during assigned work, learning reports a teacher generates</td><td>To provide VIC’s guided learning and teacher reports for the school</td></tr>
   <tr><td>Technical and safety</td><td>Request counts, error logs, and standard server logs (like IP address and browser type) kept by our hosting provider</td><td>To keep the service secure, prevent abuse, and fix problems</td></tr>
  </tbody></table>
  <p>We do <strong>not</strong> use advertising trackers, sell data to data brokers, or collect students’ precise location, photos, or biometric information.</p>

  <h2>4. How we use information</h2>
  <ul>
   <li>To provide, secure, and improve Ask VIC’s features for the people and schools using them.</li>
   <li>To send service emails you need, like sign-in links, letters you choose to send, and walkthrough feedback a school leader sends.</li>
   <li>To send occasional updates <strong>only if you chose “Yes”</strong> at signup. Every update email has an unsubscribe link, and you can also manage this on your <a href="/lessonplan/preferences">email preferences</a> page.</li>
  </ul>
  <p>We will <strong>never</strong>:</p>
  <ul>
   <li>sell or rent personal information;</li>
   <li>show advertising, or use any information for targeted advertising;</li>
   <li>build a profile of a student for any purpose other than the school’s educational purposes;</li>
   <li>use student information or your content to train AI models.</li>
  </ul>

  <h2>5. AI processing</h2>
  <p>When you ask VIC to write something, the text needed for that request is sent to our AI provider, OpenAI, through its business API.</p>
  <ul>
   <li>OpenAI does not use API data to train its models.</li>
   <li>Our requests ask OpenAI not to store them as application data. OpenAI may keep request logs for up to 30 days to detect abuse, as its API policies describe.</li>
   <li>AI writing can be wrong. Review everything before you use or send it.</li>
  </ul>

  <h2>6. Who we share information with</h2>
  <p>Only the service providers that run Ask VIC, under their own security and privacy commitments:</p>
  <ul>
   <li><strong>Supabase</strong>: database and sign-in. Data is stored in the United States.</li>
   <li><strong>Vercel</strong>: website hosting.</li>
   <li><strong>OpenAI</strong>: AI writing, as described above.</li>
   <li><strong>Resend</strong>: email delivery.</li>
  </ul>
  <p>We may also disclose information when the law requires it (for example, a valid court order), or to protect the safety of students, staff, or the service. If Ask VIC is ever transferred to a new owner, these protections go with the information, and we will tell you first.</p>
  <p>Inside a school, school leaders see only what this policy and the product describe. When a teacher joins a school, the school leader can see:</p>
  <ul>
   <li>walkthroughs about that teacher;</li>
   <li>Learning Paths the leader assigned;</li>
   <li>whether the teacher finished an assigned path, and their reflection.</li>
  </ul>
  <p>The leader <strong>never</strong> sees quiz scores, or the teacher’s own lessons, notes, letters, or personal Learning Paths.</p>

  <h2>7. Student privacy: FERPA, COPPA, and state law</h2>
  <h3>Schools stay in control</h3>
  <p>When a school or teacher uses Ask VIC with students, information about students may be part of the school’s education records under the Family Educational Rights and Privacy Act (FERPA). For that information, Ask VIC acts as a “school official” providing a service the school would otherwise do itself:</p>
  <ul>
   <li>we use it only for the school’s educational purposes, under the school’s direction;</li>
   <li>we do not share it with anyone else except as the law allows;</li>
   <li>the school controls who can see it and when it is deleted.</li>
  </ul>
  <p>Parents and eligible students who want to review, correct, or delete a student’s records should contact their school, and we will help the school respond.</p>
  <h3>Children under 13</h3>
  <p>Ask VIC is not designed for children to sign up on their own. Student accounts are created by a school or teacher. Under the Children’s Online Privacy Protection Act (COPPA), a school may consent on behalf of parents only when the service is used for the school’s educational purposes, and that is the only way we use student information. Schools are responsible for any notice to families their policies require. If we learn that a child under 13 created an account without school authorization, we will delete it.</p>
  <h3>Special education and sensitive records</h3>
  <p>Ask VIC is not a system for storing Individualized Education Programs (IEPs), Section 504 plans, evaluations, health records, or discipline files. The confidentiality rules of the Individuals with Disabilities Education Act (IDEA) build on FERPA, and those records belong in your school’s official systems. Please do not paste them into Ask VIC. When writing about a student, use “[Student]” or first names only, and describe what you observed rather than diagnoses.</p>
  <h3>State student privacy laws</h3>
  <p>Ask VIC follows Florida’s Student Online Personal Information Protection law (section 1006.1494, Florida Statutes) and similar state laws:</p>
  <ul>
   <li>no targeted advertising;</li>
   <li>no student profiles except for school purposes;</li>
   <li>no sale of student information;</li>
   <li>we collect only what is reasonably necessary;</li>
   <li>we use reasonable security;</li>
   <li>we delete student information when the school asks, or no later than 90 days after the school tells us a student has left (unless a parent asks us to keep it).</li>
  </ul>
  <p>We do not use Ask VIC to survey students about protected topics covered by the Protection of Pupil Rights Amendment (PPRA).</p>

  <h2>8. How long we keep information</h2>
  <ul>
   <li><strong>Your account and your work:</strong> kept while your account is active. Deleted within 30 days after you ask us to delete your account.</li>
   <li><strong>Student information:</strong> kept only while the school uses it. Deleted at the school’s request, and no later than 90 days after the school tells us a student has left or the school stops using Ask VIC.</li>
   <li><strong>Walkthroughs and staff records:</strong> kept for the school until the school deletes them or closes its workspace. A school leader can remove staff at any time.</li>
   <li><strong>Backups:</strong> any copies in our providers’ backups are removed as those backups expire.</li>
   <li><strong>Email-updates choices:</strong> kept as a record of your consent or unsubscribe.</li>
  </ul>

  <h2>9. How we protect information</h2>
  <ul>
   <li>All traffic is encrypted (HTTPS).</li>
   <li>Database access is restricted by account and school role.</li>
   <li>Private keys stay on our servers, never in the browser.</li>
   <li>Access to systems is limited to what is needed to run Ask VIC.</li>
  </ul>
  <p>No system is perfectly secure. If a breach affects your information, we will notify affected users and schools without unreasonable delay, as the law requires.</p>

  <h2>10. Your choices and rights</h2>
  <ul>
   <li><strong>See, correct, or delete</strong> your information: email {mail}.</li>
   <li><strong>Email updates:</strong> change your mind anytime with the unsubscribe link or your <a href="/lessonplan/preferences">email preferences</a>. Service emails, like sign-in links, still arrive.</li>
   <li><strong>School accounts:</strong> requests about student or staff records go through the school, and we will help.</li>
  </ul>
  <p>Depending on where you live, you may have additional privacy rights, and we will honor them.</p>

  <h2>11. Changes to this policy</h2>
  <p>If we make a meaningful change, we will update the date above and let account holders know before it takes effect.</p>

  <h2>12. Contact</h2>
  <p>Dr. L. Robert Furman, Ask VIC · {mail}</p>
 </LegalPage>
}
