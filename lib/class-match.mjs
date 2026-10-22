const SUBJECT_WORDS = { math: /math/i, reading: /reading|ela|english|language/i, ela: /reading|ela|english|language/i, science: /science/i, 'social studies': /social/i, social: /social/i }
const VIC_CLASS = /\bVIC\b/

// Which of the teacher's classes a lesson is for: the only class they have, else the one whose
// grade and subject match the lesson's. Null when it can't tell, so the teacher is asked.
// VIC & IXL classes never receive a teacher's subject lesson by guesswork; those kids get it
// through their Math & Science or ELA & Social Studies class.
export function matchClass(classes, week) {
 if (!classes.length) return null
 const picked = Number(week.settings?.classId)
 if (picked && classes.some(c => Number(c.id) === picked)) return classes.find(c => Number(c.id) === picked)
 if (classes.length === 1) return classes[0]
 const grade = week.grade === 'K' ? 0 : Number(week.grade)
 const words = SUBJECT_WORDS[String(week.subject || '').toLowerCase()]
 const fits = classes.filter(c => !VIC_CLASS.test(c.class_name || '') && (c.grade_level == null || Number(c.grade_level) === grade) && (!words || words.test(c.class_name || '')))
 if (fits.length === 1) return fits[0]
 const strict = fits.filter(c => c.grade_level != null)
 return strict.length === 1 ? strict[0] : null
}
