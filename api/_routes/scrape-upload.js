import { requireUser, err, send, withCors } from '../_lib/auth.js'

async function isMember(supabase, sessionId, userId) {
  const { data } = await supabase
    .from('session_members')
    .select('id')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .single()
  return !!data
}

/**
 * POST /api/scrape/upload
 * Body: {
 *   session_id: string,
 *   applicants: Array<{
 *     wg_conversation_id: string,
 *     name: string,
 *     profile_url: string,
 *     photo_url: string,
 *     last_message_id: string,
 *     messages: Array<{
 *       wg_message_id: string,
 *       sender_name: string,
 *       is_from_applicant: boolean,
 *       content: string,
 *       sent_at: string,
 *     }>
 *   }>
 * }
 */
export default withCors(async function handler(req, res) {
  if (req.method !== 'POST') return err(res, 405, 'Method not allowed')

  try {
    const { user, supabase } = await requireUser(req)
    const { session_id, applicants } = req.body

    if (!session_id || !Array.isArray(applicants)) {
      return err(res, 400, 'session_id and applicants array required')
    }

    if (!await isMember(supabase, session_id, user.id)) {
      return err(res, 403, 'Not a member of this session')
    }

    let insertedApplicants = 0
    let insertedMessages = 0

    for (const applicant of applicants) {
      const { wg_conversation_id, name, profile_url, photo_url, last_message_id, messages = [] } = applicant

      // Upsert applicant
      const { data: applicantRow, error: aErr } = await supabase
        .from('applicants')
        .upsert({
          session_id,
          wg_conversation_id,
          name: name || null,
          profile_url: profile_url || null,
          photo_url: photo_url || null,
          last_message_id: last_message_id || null,
        }, { onConflict: 'session_id,wg_conversation_id' })
        .select('id')
        .single()

      if (aErr) {
        console.error('Applicant upsert error:', aErr.message)
        continue
      }

      insertedApplicants++

      if (!messages.length) continue

      // Upsert messages (ignore duplicates)
      const messageRows = messages.map(m => ({
        applicant_id: applicantRow.id,
        wg_message_id: m.wg_message_id,
        sender_name: m.sender_name || null,
        is_from_applicant: m.is_from_applicant !== false,
        content: m.content || '',
        sent_at: m.sent_at || null,
      }))

      const { error: mErr } = await supabase
        .from('messages')
        .upsert(messageRows, { onConflict: 'applicant_id,wg_message_id' })

      if (mErr) {
        console.error('Messages upsert error:', mErr.message)
      } else {
        insertedMessages += messageRows.length
      }
    }

    return send(res, 200, { ok: true, insertedApplicants, insertedMessages })
  } catch (e) {
    return err(res, 401, e.message)
  }
})
