function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildBullets(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('')
}

export function buildReportHtml(reportData = {}) {
  const {
    studentName = 'Student',
    gradeLevel = '',
    date = '',
    sessionFocus = 'General support session',
    studentInterest = '',
    report = {},
  } = reportData

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>VIC Learning Report</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 28px; line-height: 1.45; }
          h1 { margin: 0 0 16px; font-size: 26px; }
          h2 { margin: 22px 0 8px; font-size: 18px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
          p { margin: 4px 0; }
          ul { margin: 8px 0 4px 20px; }
          li { margin-bottom: 6px; }
          .meta { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
        </style>
      </head>
      <body>
        <h1>VIC Learning Report</h1>
        <div class="meta">
          <p><strong>Student Name:</strong> ${escapeHtml(studentName)}</p>
          ${gradeLevel ? `<p><strong>Grade Level:</strong> ${escapeHtml(gradeLevel)}</p>` : ''}
          <p><strong>Date:</strong> ${escapeHtml(date)}</p>
          <p><strong>Session Focus / Topic:</strong> ${escapeHtml(sessionFocus)}</p>
          ${studentInterest ? `<p><strong>Student Interest Used:</strong> ${escapeHtml(studentInterest)}</p>` : ''}
        </div>

        <h2>1. Performance Summary</h2>
        <p>${escapeHtml(report.performanceSummary || 'Not available.')}</p>

        <h2>2. Primary Strength</h2>
        <p>${escapeHtml(report.primaryStrength || 'Not available.')}</p>

        <h2>3. Primary Area for Growth</h2>
        <p>${escapeHtml(report.primaryAreaForGrowth || 'Not available.')}</p>

        <h2>4. Skills Demonstrated</h2>
        <ul>${buildBullets(report.skillsDemonstrated)}</ul>

        <h2>5. Areas for Growth</h2>
        <ul>${buildBullets(report.areasForGrowth)}</ul>

        <h2>6. Next Instructional Steps</h2>
        <ul>${buildBullets(report.nextInstructionalSteps)}</ul>

        <h2>7. Session Evidence / Sample Work</h2>
        <ul>${buildBullets(report.sessionEvidence)}</ul>

        <h2>8. Optional Parent-Friendly Summary</h2>
        <p>${escapeHtml(report.parentFriendlySummary || 'Not available.')}</p>
      </body>
    </html>
  `
}

export function buildReportEmailText(reportData = {}) {
  const {
    studentName = 'Student',
    gradeLevel = '',
    date = '',
    sessionFocus = 'General support session',
    studentInterest = '',
    report = {},
  } = reportData

  const toList = (items) => {
    if (!Array.isArray(items) || items.length === 0) return '- Not available.'
    return items.map((item) => `- ${item}`).join('\n')
  }

  return [
    'VIC Learning Report',
    '',
    `Student Name: ${studentName}`,
    gradeLevel ? `Grade Level: ${gradeLevel}` : '',
    `Date: ${date}`,
    `Session Focus / Topic: ${sessionFocus}`,
    studentInterest ? `Student Interest Used: ${studentInterest}` : '',
    '',
    '1. Performance Summary',
    report.performanceSummary || 'Not available.',
    '',
    '2. Primary Strength',
    report.primaryStrength || 'Not available.',
    '',
    '3. Primary Area for Growth',
    report.primaryAreaForGrowth || 'Not available.',
    '',
    '4. Skills Demonstrated',
    toList(report.skillsDemonstrated),
    '',
    '5. Areas for Growth',
    toList(report.areasForGrowth),
    '',
    '6. Next Instructional Steps',
    toList(report.nextInstructionalSteps),
    '',
    '7. Session Evidence / Sample Work',
    toList(report.sessionEvidence),
    '',
    '8. Optional Parent-Friendly Summary',
    report.parentFriendlySummary || 'Not available.',
  ]
    .filter(Boolean)
    .join('\n')
}
