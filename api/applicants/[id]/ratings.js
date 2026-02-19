import { requireUser, err, send, withCors } from '../../_lib/auth.js'

async function getApplicantSession(supabase, applicantId) {
  const { data } = await supabase
    .from('applicants')
    .select('session_id')
    .eq('id', applicantId)
    .single()
  return data?.session_id
}

async function isMember(supabase, sessionId, userId) {
  const { data } = await supabase
    .from('session_members')
    .select('id')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .single()
  return !!data
}

export default withCors(async function handler(req, res) {
  const { id } = req.query
  try {
    const { user, supabase } = await requireUser(req)
    const sessionId = await getApplicantSession(supabase, id)
    if (!sessionId) return err(res, 404, 'Applicant not found')
    if (!await isMember(supabase, sessionId, user.id)) return err(res, 403, 'Not a member')

    if (req.method === 'PUT') {
      const { rating, comment } = req.body

      const { error } = await supabase
        .from('ratings')
        .upsert({
          applicant_id: id,
          user_id: user.id,
          rating: rating == null ? null : Number(rating),
          comment: comment ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'applicant_id,user_id' })

      if (error) return err(res, 500, error.message)
      return send(res, 200, { ok: true })
    }

    return err(res, 405, 'Method not allowed')
  } catch (e) {
    return err(res, 401, e.message)
  }
})
