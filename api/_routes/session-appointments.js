import { requireUser, err, send, withCors } from '../_lib/auth.js'

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
  const { id, date } = req.query
  try {
    const { user, supabase } = await requireUser(req)
    if (!await isMember(supabase, id, user.id)) return err(res, 403, 'Not a member')

    if (req.method === 'GET') {
      let query = supabase
        .from('applicant_appointments')
        .select('id, applicant_id, date, hour, booked_by, applicants(name, wg_conversation_id)')
        .eq('session_id', id)

      if (date) query = query.eq('date', date)

      const { data, error } = await query.order('hour', { ascending: true })
      if (error) return err(res, 500, error.message)
      return send(res, 200, data ?? [])
    }

    if (req.method === 'POST') {
      const { date: d, hour, applicant_id } = req.body

      if (applicant_id === null || applicant_id === '') {
        // Remove booking for this slot
        await supabase
          .from('applicant_appointments')
          .delete()
          .eq('session_id', id)
          .eq('date', d)
          .eq('hour', hour)
        return send(res, 200, { ok: true })
      }

      const { error } = await supabase
        .from('applicant_appointments')
        .upsert({
          session_id: id,
          applicant_id,
          date: d,
          hour,
          booked_by: user.id,
        }, { onConflict: 'session_id,date,hour' })

      if (error) return err(res, 500, error.message)
      return send(res, 200, { ok: true })
    }

    return err(res, 405, 'Method not allowed')
  } catch (e) {
    return err(res, 401, e.message)
  }
})
