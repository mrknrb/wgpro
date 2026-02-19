import { requireUser, err, send, withCors } from '../_lib/auth.js'

async function isAdmin(supabase, sessionId, userId) {
  const { data } = await supabase
    .from('session_members')
    .select('is_admin')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .single()
  return data?.is_admin === true
}

export default withCors(async function handler(req, res) {
  const { id } = req.query
  try {
    const { user, supabase } = await requireUser(req)

    if (req.method === 'GET') {
      // List pending requests — admin only
      if (!await isAdmin(supabase, id, user.id)) return err(res, 403, 'Admin only')

      const { data, error } = await supabase
        .from('join_requests')
        .select('id, user_id, status, requested_at')
        .eq('session_id', id)
        .eq('status', 'pending')
        .order('requested_at', { ascending: true })

      if (error) return err(res, 500, error.message)

      // We don't have emails without service role. Return user_id + placeholder.
      // The client will display them as user IDs, or set up a profiles table.
      const enriched = (data ?? []).map(r => ({
        ...r,
        user_email: r.user_id, // placeholder until profiles table
      }))

      return send(res, 200, enriched)
    }

    if (req.method === 'POST') {
      if (!await isAdmin(supabase, id, user.id)) return err(res, 403, 'Admin only')

      const { request_id, status } = req.body
      if (!['approved', 'rejected'].includes(status)) return err(res, 400, 'Invalid status')

      // Get request info
      const { data: joinReq, error: reqErr } = await supabase
        .from('join_requests')
        .select('user_id')
        .eq('id', request_id)
        .eq('session_id', id)
        .single()

      if (reqErr || !joinReq) return err(res, 404, 'Request not found')

      // Update status
      await supabase.from('join_requests').update({ status }).eq('id', request_id)

      if (status === 'approved') {
        // Add user as member
        await supabase.from('session_members').upsert({
          session_id: id,
          user_id: joinReq.user_id,
          is_admin: false,
        })
      }

      return send(res, 200, { ok: true })
    }

    return err(res, 405, 'Method not allowed')
  } catch (e) {
    return err(res, 401, e.message)
  }
})
