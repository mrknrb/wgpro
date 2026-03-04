import { requireUser, err, send, withCors } from '../_lib/auth.js'

export default withCors(async function handler(req, res) {
  if (req.method !== 'GET') return err(res, 405, 'Method not allowed')
  try {
    const { user, supabase } = await requireUser(req)

    const { data, error } = await supabase
      .from('join_requests')
      .select('id, status, requested_at, sessions(id, name)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })

    if (error) return err(res, 500, error.message)
    return send(res, 200, data ?? [])
  } catch (e) {
    return err(res, 401, e.message)
  }
})
