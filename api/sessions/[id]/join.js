import { requireUser, err, send, withCors } from '../../_lib/auth.js'

export default withCors(async function handler(req, res) {
  const { id } = req.query
  if (req.method !== 'POST') return err(res, 405, 'Method not allowed')

  try {
    const { user, supabase } = await requireUser(req)
    const { token } = req.body

    // Verify invite token belongs to this session
    const { data: invite } = await supabase
      .from('session_invites')
      .select('id')
      .eq('token', token)
      .eq('session_id', id)
      .single()

    if (!invite) return err(res, 403, 'Invalid invite token')

    // Check not already a member
    const { data: existing } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', id)
      .eq('user_id', user.id)
      .single()

    if (existing) return send(res, 200, { status: 'already_member' })

    // Check for existing pending request
    const { data: existingReq } = await supabase
      .from('join_requests')
      .select('id, status')
      .eq('session_id', id)
      .eq('user_id', user.id)
      .single()

    if (existingReq) return send(res, 200, { status: existingReq.status })

    // Create join request — store email for admin display
    const { error } = await supabase.from('join_requests').insert({
      session_id: id,
      user_id: user.id,
      invite_token: token,
    })

    if (error) return err(res, 500, error.message)
    return send(res, 201, { status: 'pending' })
  } catch (e) {
    return err(res, 401, e.message)
  }
})
