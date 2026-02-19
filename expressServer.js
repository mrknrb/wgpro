import 'dotenv/config'
import express from 'express'

// API handlers
import sessionsHandler from './api/sessions/index.js'
import sessionByIdHandler from './api/sessions/[id]/index.js'
import sessionMembersHandler from './api/sessions/[id]/members.js'
import sessionInviteHandler from './api/sessions/[id]/invite.js'
import sessionJoinHandler from './api/sessions/[id]/join.js'
import sessionApproveHandler from './api/sessions/[id]/approve.js'
import sessionApplicantsHandler from './api/sessions/[id]/applicants.js'
import sessionAiConfigHandler from './api/sessions/[id]/ai-config.js'
import sessionAppointmentsHandler from './api/sessions/[id]/appointments.js'
import applicantRatingsHandler from './api/applicants/[id]/ratings.js'
import applicantAiRateHandler from './api/applicants/[id]/ai-rate.js'
import scrapeUploadHandler from './api/scrape/upload.js'
import availabilityHandler from './api/availability/index.js'

const app = express()
const PORT = process.env.PORT || 3010

app.use(express.json())

// Merge Express route params into req.query so all handlers can use req.query.id
// (same convention as Vercel serverless functions)
// Express 5 made req.query a read-only getter, so we override it with defineProperty.
function withParams(handler) {
  return (req, res) => {
    const merged = { ...req.params, ...req.query }
    Object.defineProperty(req, 'query', { get: () => merged, configurable: true })
    handler(req, res)
  }
}

// Sessions
app.all('/api/sessions', sessionsHandler)
app.all('/api/sessions/:id', withParams(sessionByIdHandler))
app.all('/api/sessions/:id/members', withParams(sessionMembersHandler))
app.all('/api/sessions/:id/invite', withParams(sessionInviteHandler))
app.all('/api/sessions/:id/join', withParams(sessionJoinHandler))
app.all('/api/sessions/:id/approve', withParams(sessionApproveHandler))
app.all('/api/sessions/:id/applicants', withParams(sessionApplicantsHandler))
app.all('/api/sessions/:id/ai-config', withParams(sessionAiConfigHandler))
app.all('/api/sessions/:id/appointments', withParams(sessionAppointmentsHandler))

// Applicants
app.all('/api/applicants/:id/ratings', withParams(applicantRatingsHandler))
app.all('/api/applicants/:id/ai-rate', withParams(applicantAiRateHandler))

// Scrape upload (from Chrome extension)
app.all('/api/scrape/upload', scrapeUploadHandler)

// Availability
app.all('/api/availability', availabilityHandler)

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
