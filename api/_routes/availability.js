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
  const session_id = req.query.session_id ?? req.body?.session_id
  const { date } = req.query
  try {
    const { user, supabase } = await requireUser(req)
    if (!await isMember(supabase, session_id, user.id)) return err(res, 403, 'Not a member')

    if (req.method === 'GET') {
      let query = supabase
        .from('member_availability')
        .select('user_id, date, hour')
        .eq('session_id', session_id)

      if (date) query = query.eq('date', date)

      const { data, error } = await query
      if (error) return err(res, 500, error.message)
      return send(res, 200, data ?? [])
    }

    if (req.method === 'POST') {
      const { date: d, hour, available } = req.body

      if (available) {
        const { error } = await supabase
          .from('member_availability')
          .upsert({
            session_id,
            user_id: user.id,
            date: d,
            hour,
          }, { onConflict: 'session_id,user_id,date,hour' })
        if (error) return err(res, 500, error.message)
      } else {
        await supabase
          .from('member_availability')
          .delete()
          .eq('session_id', session_id)
          .eq('user_id', user.id)
          .eq('date', d)
          .eq('hour', hour)
      }

      return send(res, 200, { ok: true })
    }

    return err(res, 405, 'Method not allowed')
  } catch (e) {
    return err(res, 401, e.message)
  }
})
