import { requireUser, err, send, withCors } from '../../_lib/auth.js'

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
    if (!await isMember(supabase, id, user.id)) return err(res, 403, 'Not a member')

    if (req.method === 'GET') {
      const { data } = await supabase
        .from('ai_configs')
        .select('system_prompt, updated_at')
        .eq('session_id', id)
        .single()

      return send(res, 200, data ?? { system_prompt: '' })
    }

    if (req.method === 'PUT') {
      const { system_prompt } = req.body
      const { error } = await supabase
        .from('ai_configs')
        .upsert({ session_id: id, system_prompt, updated_at: new Date().toISOString() }, { onConflict: 'session_id' })

      if (error) return err(res, 500, error.message)
      return send(res, 200, { ok: true })
    }

    return err(res, 405, 'Method not allowed')
  } catch (e) {
    return err(res, 401, e.message)
  }
})
