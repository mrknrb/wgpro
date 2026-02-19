import { requireUser, err, send, withCors } from '../../_lib/auth.js'

async function isMember(supabase, sessionId, userId) {
  const { data } = await supabase
    .from('session_members')
    .select('is_admin')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .single()
  return data
}

export default withCors(async function handler(req, res) {
  const { id } = req.query
  try {
    const { user, supabase } = await requireUser(req)
    const membership = await isMember(supabase, id, user.id)
    if (!membership) return err(res, 403, 'Not a member')

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('session_members')
        .select('user_id, is_admin, joined_at')
        .eq('session_id', id)

      if (error) return err(res, 500, error.message)

      // Fetch emails from auth.users via admin API is not possible with anon key.
      // Instead, store email in a profiles table or use the user's own email.
      // We'll return what we have; the extension/frontend shows email from local state.
      // To get emails we use the service role — but we only have the public key.
      // Workaround: store email in session_members on join.
      return send(res, 200, data)
    }

    if (req.method === 'PATCH') {
      // Toggle admin — only admins can do this
      if (!membership.is_admin) return err(res, 403, 'Admin only')
      const { user_id, is_admin } = req.body
      const { error } = await supabase
        .from('session_members')
        .update({ is_admin })
        .eq('session_id', id)
        .eq('user_id', user_id)

      if (error) return err(res, 500, error.message)
      return send(res, 200, { ok: true })
    }

    return err(res, 405, 'Method not allowed')
  } catch (e) {
    return err(res, 401, e.message)
  }
})
