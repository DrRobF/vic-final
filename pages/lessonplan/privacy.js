import {useEffect} from 'react'
import VICHeader from '../../components/VICHeader'
// The Lesson Designer privacy notice is now part of the full Ask VIC Privacy Policy.
export default function LessonPrivacy(){
 useEffect(()=>{window.location.replace('/privacy')},[])
 return <main style={{maxWidth:850,margin:'auto',padding:28}}><VICHeader currentPath="/lessonplan"/><p>Our privacy notice has moved to the full <a href="/privacy">Ask VIC Privacy Policy</a>.</p></main>
}
