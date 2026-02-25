import express from 'express'

import sessionsHandler from './_routes/sessions.js'
import sessionByIdHandler from './_routes/session.js'
import sessionMembersHandler from './_routes/session-members.js'
import sessionInviteHandler from './_routes/session-invite.js'
import sessionJoinHandler from './_routes/session-join.js'
import sessionApproveHandler from './_routes/session-approve.js'
import sessionApplicantsHandler from './_routes/session-applicants.js'
import sessionAiConfigHandler from './_routes/session-ai-config.js'
import sessionAppointmentsHandler from './_routes/session-appointments.js'
import applicantRatingsHandler from './_routes/applicant-ratings.js'
import applicantFavouriteHandler from './_routes/applicant-favourite.js'
import applicantStatusHandler from './_routes/applicant-status.js'
import applicantAiRateHandler from './_routes/applicant-ai-rate.js'
import scrapeUploadHandler from './_routes/scrape-upload.js'
import availabilityHandler from './_routes/availability.js'

const app = express()

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
app.all('/api/applicants/:id/favourite', withParams(applicantFavouriteHandler))
app.all('/api/applicants/:id/status', withParams(applicantStatusHandler))
app.all('/api/applicants/:id/ai-rate', withParams(applicantAiRateHandler))

// Scrape upload (from Chrome extension)
app.all('/api/scrape/upload', scrapeUploadHandler)

// Availability
app.all('/api/availability', availabilityHandler)

export default app
