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
  const { id, minimal } = req.query
  try {
    const { user, supabase } = await requireUser(req)
    if (!await isMember(supabase, id, user.id)) return err(res, 403, 'Not a member')

    if (req.method === 'GET') {
      if (minimal === 'true') {
        // Lightweight list for appointment dropdowns
        const { data, error } = await supabase
          .from('applicants')
          .select('id, name, wg_conversation_id, last_message_id')
          .eq('session_id', id)
          .order('created_at', { ascending: false })

        if (error) return err(res, 500, error.message)
        return send(res, 200, data ?? [])
      }

      // Full list with messages and ratings
      const { data: applicants, error } = await supabase
        .from('applicants')
        .select('id, name, profile_url, photo_url, wg_conversation_id, last_message_id, created_at')
        .eq('session_id', id)

      if (error) return err(res, 500, error.message)

      const enriched = await Promise.all(
        (applicants ?? []).map(async (applicant) => {
          const [messagesRes, ratingsRes, aiRatingRes] = await Promise.all([
            supabase
              .from('messages')
              .select('id, wg_message_id, sender_name, is_from_applicant, content, sent_at')
              .eq('applicant_id', applicant.id)
              .order('sent_at', { ascending: true }),
            supabase
              .from('ratings')
              .select('user_id, rating, comment')
              .eq('applicant_id', applicant.id),
            supabase
              .from('ai_ratings')
              .select('rating, comment')
              .eq('applicant_id', applicant.id)
              .single(),
          ])

          // Build ratings map: { [user_id]: { rating, comment } }
          const ratingsMap = {}
          for (const r of ratingsRes.data ?? []) {
            ratingsMap[r.user_id] = { rating: r.rating, comment: r.comment }
          }

          return {
            ...applicant,
            messages: messagesRes.data ?? [],
            ratings: ratingsMap,
            ai_rating: aiRatingRes.data ?? null,
          }
        })
      )

      return send(res, 200, enriched)
    }

    return err(res, 405, 'Method not allowed')
  } catch (e) {
    return err(res, 401, e.message)
  }
})
