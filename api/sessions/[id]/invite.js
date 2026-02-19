import { requireUser, getSupabase, err, send, withCors } from '../../_lib/auth.js'

export default withCors(async function handler(req, res) {
  const { id, token } = req.query

  if (req.method === 'GET') {
    // Public: verify a token and return session name
    const supabase = getSupabase()
    const { data: invite } = await supabase
      .from('session_invites')
      .select('session_id, sessions(name)')
      .eq('token', token)
      .eq('session_id', id)
      .single()

    if (!invite) return err(res, 404, 'Invalid invite token')
    return send(res, 200, { name: invite.sessions?.name })
  }

  if (req.method === 'POST') {
    // Generate a new invite token (any member can do this)
    try {
      const { user, supabase } = await requireUser(req)

      const { data: member } = await supabase
        .from('session_members')
        .select('id')
        .eq('session_id', id)
        .eq('user_id', user.id)
        .single()

      if (!member) return err(res, 403, 'Not a member')

      const { data: invite, error } = await supabase
        .from('session_invites')
        .insert({ session_id: id, created_by: user.id })
        .select()
        .single()

      if (error) return err(res, 500, error.message)
      return send(res, 201, { token: invite.token })
    } catch (e) {
      return err(res, 401, e.message)
    }
  }

  return err(res, 405, 'Method not allowed')
})
