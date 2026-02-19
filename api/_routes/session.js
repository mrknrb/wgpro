import { requireUser, err, send, withCors } from '../_lib/auth.js'

export default withCors(async function handler(req, res) {
  const { id } = req.query
  try {
    const { user, supabase } = await requireUser(req)

    if (req.method === 'GET') {
      // Check membership
      const { data: member } = await supabase
        .from('session_members')
        .select('is_admin')
        .eq('session_id', id)
        .eq('user_id', user.id)
        .single()

      if (!member) return err(res, 403, 'Not a member')

      const { data: session, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .single()

      if (error) return err(res, 404, 'Session not found')

      return send(res, 200, { ...session, is_admin: member.is_admin })
    }

    if (req.method === 'PATCH') {
      // Only admins can update session settings
      const { data: member } = await supabase
        .from('session_members')
        .select('is_admin')
        .eq('session_id', id)
        .eq('user_id', user.id)
        .single()

      if (!member?.is_admin) return err(res, 403, 'Admin only')

      const { ad_url, scrape_cutoff_date } = req.body
      let wg_ad_id = null
      if (ad_url) {
        const match = ad_url.match(/(\d{6,})/)
        if (match) wg_ad_id = match[1]
      }

      const { data: updated, error: updateErr } = await supabase
        .from('sessions')
        .update({ ad_url: ad_url || null, wg_ad_id, scrape_cutoff_date: scrape_cutoff_date || null })
        .eq('id', id)
        .select()
        .single()

      if (updateErr) return err(res, 500, updateErr.message)
      return send(res, 200, updated)
    }

    return err(res, 405, 'Method not allowed')
  } catch (e) {
    return err(res, 401, e.message)
  }
})
