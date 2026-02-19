import { requireUser, err, send, withCors } from '../_lib/auth.js'

export default withCors(async function handler(req, res) {
  try {
    const { user, supabase } = await requireUser(req)

    if (req.method === 'GET') {
      // List sessions where user is a member
      const { data, error } = await supabase
        .from('session_members')
        .select(`
          is_admin,
          sessions (
            id, name, ad_url, wg_ad_id, scrape_cutoff_date, created_at, created_by
          )
        `)
        .eq('user_id', user.id)

      if (error) return err(res, 500, error.message)

      // Enrich with counts
      const sessions = await Promise.all(
        (data ?? []).map(async (row) => {
          const session = row.sessions
          const [membersRes, applicantsRes] = await Promise.all([
            supabase.from('session_members').select('id', { count: 'exact', head: true }).eq('session_id', session.id),
            supabase.from('applicants').select('id', { count: 'exact', head: true }).eq('session_id', session.id),
          ])
          return {
            ...session,
            is_admin: row.is_admin,
            member_count: membersRes.count ?? 0,
            applicant_count: applicantsRes.count ?? 0,
          }
        })
      )

      return send(res, 200, sessions)
    }

    if (req.method === 'POST') {
      const { name, ad_url } = req.body
      if (!name) return err(res, 400, 'name is required')

      // Extract wg_ad_id from URL if present
      let wg_ad_id = null
      if (ad_url) {
        const match = ad_url.match(/(\d{6,})/)
        if (match) wg_ad_id = match[1]
      }

      const { data: session, error: sessionErr } = await supabase
        .from('sessions')
        .insert({ name, ad_url: ad_url || null, wg_ad_id, created_by: user.id })
        .select()
        .single()

      if (sessionErr) return err(res, 500, sessionErr.message)

      // Add creator as admin member
      await supabase.from('session_members').insert({
        session_id: session.id,
        user_id: user.id,
        is_admin: true,
      })

      // Create default AI config
      await supabase.from('ai_configs').insert({ session_id: session.id })

      return send(res, 201, session)
    }

    return err(res, 405, 'Method not allowed')
  } catch (e) {
    return err(res, 401, e.message)
  }
})
