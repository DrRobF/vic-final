import Head from 'next/head'
import VICHeader from '../components/VICHeader'
import EducatorAuth from '../components/EducatorAuth'
export default function Signup(){
 return <><Head><title>Sign up free | Ask VIC Lesson Designer</title></Head><main className="shell"><VICHeader currentPath="/signup"/><div className="intro"><p>ASK VIC · FREE EDUCATOR ACCESS</p><h1>More time to teach.<br/>Less time preparing.</h1><p>Choose built-in Florida and Pennsylvania K–8 reading and math standards, or use our state links to add your own.</p></div><div className="form-wrap"><EducatorAuth mode="signup"/></div></main><style jsx>{`.shell{max-width:1100px;margin:auto;padding:24px}.intro{max-width:650px;margin:40px auto 24px;text-align:center}.intro>p:first-child{font-size:12px;font-weight:800;letter-spacing:.12em;color:var(--vic-primary)}h1{font-size:42px;line-height:1.15;margin:16px 0}.intro p{line-height:1.6}.form-wrap{max-width:650px;margin:0 auto 48px}@media(max-width:600px){h1{font-size:32px}}`}</style></>
}
