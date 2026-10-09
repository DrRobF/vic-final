import LegalPage,{CONTACT_EMAIL} from '../components/LegalPage'

const mail=<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

export default function Terms(){
 return <LegalPage title="Terms of Use" description="The rules for using Ask VIC: who can use it, protecting student information, AI-generated content, school accounts, and your rights to your work."
  summary={<>
   <p><strong>The short version.</strong></p>
   <ul>
    <li>Ask VIC is for adult educators.</li>
    <li>Your work is yours.</li>
    <li>Treat student information the way your school requires.</li>
    <li>Always review what VIC writes before you use or send it.</li>
    <li>Ask VIC is free right now and provided as is. We’ll tell you before anything about that changes.</li>
   </ul>
  </>}>

  <h2>1. Agreement</h2>
  <p>These Terms of Use (“Terms”) are an agreement between you and Dr. L. Robert Furman, who operates Ask VIC at askvic.ai (“Ask VIC,” “we,” “us”). By creating an account or using Ask VIC, you agree to these Terms and to our <a href="/privacy">Privacy Policy</a>. If you use Ask VIC for a school, you confirm you have permission from that school to do so.</p>

  <h2>2. Who can use Ask VIC</h2>
  <ul>
   <li><strong>Educator accounts</strong> are for adults (18 or older) who work in or with schools.</li>
   <li><strong>Student accounts</strong> are created and managed only by a school or teacher, for school purposes. Students may not create their own accounts.</li>
   <li>You are responsible for keeping your sign-in private and for activity on your account. Tell us right away at {mail} if you think someone else has used it.</li>
  </ul>

  <h2>3. Protecting student and staff information</h2>
  <p>You agree to use Ask VIC in line with your school’s policies and with laws that protect students, including FERPA, COPPA, IDEA, and your state’s student privacy laws. In particular:</p>
  <ul>
   <li>Share only the student information needed for the task. In your personal tools (like the assistant, quick parent emails, and lesson notes), use “[Student]” or first names only.</li>
   <li>Do not upload IEPs, 504 plans, evaluations, health or discipline records, Social Security numbers, or other sensitive records.</li>
   <li>Use classroom features with students only if your school allows Ask VIC. Schools are responsible for any parent notice or consent their policies require.</li>
   <li>School leaders: record walkthroughs and staff information only for legitimate supervision and support, and keep private administrative notes professional. Walkthroughs in Ask VIC are informal, growth-focused feedback, not a formal evaluation system, unless your school decides otherwise under its own policies.</li>
  </ul>

  <h2>4. AI-generated content</h2>
  <ul>
   <li>VIC uses artificial intelligence. Its suggestions can be incomplete, outdated, or wrong.</li>
   <li>You are responsible for reviewing, editing, and approving anything before you teach it, send it to families, or rely on it.</li>
   <li>VIC does not give legal, medical, psychological, or special-education eligibility advice.</li>
   <li>Links in Learning Paths are checked when the path is built, but they belong to other websites that we don’t control.</li>
   <li>Learning Paths certificates record self-directed learning. They are not official continuing-education credit unless your school or state accepts them.</li>
  </ul>

  <h2>5. Your content</h2>
  <p>You own what you create and upload, including lessons, notes, letters, reflections, and walkthrough records. You give us permission to store, process, and display that content only as needed to run Ask VIC for you and your school. We do not use your content to train AI models or for advertising. Delete your content or ask us to delete it anytime, as the <a href="/privacy">Privacy Policy</a> describes.</p>

  <h2>6. School accounts</h2>
  <ul>
   <li><strong>Who can set one up:</strong> a school leader who sets up a school workspace confirms they are authorized to do so for that school.</li>
   <li><strong>Seats and codes:</strong> each school has a number of seats. Everyone on the staff list uses one, whether a leader added them or they joined with the school code. Leaders may change the code or remove staff at any time.</li>
   <li><strong>Teachers who join:</strong> a teacher who joins a school agrees that its leaders may see the information the join screen describes. That means walkthroughs, assigned Learning Paths, completion, and reflections, and never quiz scores or private work.</li>
   <li><strong>School data:</strong> schools control their own records, and we follow their instructions for them.</li>
  </ul>

  <h2>7. Acceptable use</h2>
  <p>Please don’t:</p>
  <ul>
   <li>break the law, or use Ask VIC to harass, discriminate, or harm anyone;</li>
   <li>upload content you don’t have the right to share;</li>
   <li>try to access accounts or schools that aren’t yours;</li>
   <li>overload, probe, or reverse-engineer the service, or get around its limits;</li>
   <li>use Ask VIC to make decisions about students without human review.</li>
  </ul>
  <p>We may suspend accounts that put students, staff, or the service at risk.</p>

  <h2>8. Free service and changes</h2>
  <p>Ask VIC is currently free for educators. We may add, change, or remove features, and we may offer paid plans for schools in the future. We’ll give reasonable notice before any change that affects what you pay or what you can access, and you’ll always be able to download or request a copy of your content.</p>

  <h2>9. Our property</h2>
  <p>Ask VIC’s name, logo, software, and design belong to Dr. L. Robert Furman. These Terms don’t give you rights to them beyond using Ask VIC as intended.</p>

  <h2>10. Disclaimers and limits</h2>
  <p>Ask VIC is provided “as is” and “as available,” without warranties of any kind, to the fullest extent the law allows. To the fullest extent the law allows, we are not liable for indirect, incidental, or consequential damages, or for decisions made based on AI-generated content. Our total liability for any claim related to Ask VIC is limited to the greater of the amount you paid us in the past 12 months or $100. Some places don’t allow these limits, so they may not apply to you.</p>

  <h2>11. Ending your use</h2>
  <p>You can stop using Ask VIC and ask us to delete your account anytime. We may end or suspend access if these Terms are broken or if needed to protect students or the service. Sections 5, 9, 10, and 12 continue after your use ends.</p>

  <h2>12. Governing law</h2>
  <p>These Terms are governed by the laws of the State of Florida, without regard to its conflict-of-law rules. Any dispute will be handled in the state or federal courts located in Florida, unless the law requires otherwise. Public schools and agencies may have legal requirements that override this section, and we will work with them in good faith.</p>

  <h2>13. Changes to these Terms</h2>
  <p>If we make meaningful changes, we’ll update the date above and let account holders know before they take effect. Continuing to use Ask VIC after that means you accept the updated Terms.</p>

  <h2>14. Contact</h2>
  <p>Dr. L. Robert Furman, Ask VIC · {mail}</p>
 </LegalPage>
}
