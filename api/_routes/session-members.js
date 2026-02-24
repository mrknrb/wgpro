import { requireUser, err, send, withCors } from '../_lib/auth.js'

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
      const { data: membersData, error } = await supabase
        .from('session_members')
        .select('user_id, is_admin, joined_at')
        .eq('session_id', id)

      if (error) return err(res, 500, error.message)

      const userIds = membersData.map(m => m.user_id)
      const { data: profilesData, error: profilesError } = await supabase
        .rpc('get_profiles', { p_user_ids: userIds })

      if (profilesError) return err(res, 500, 'profiles: ' + profilesError.message)

      const profileMap = Object.fromEntries((profilesData ?? []).map(p => [p.user_id, p.username]))
      const data = membersData.map(m => ({ ...m, username: profileMap[m.user_id] ?? null }))

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
