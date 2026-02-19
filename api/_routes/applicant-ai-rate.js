import { requireUser, err, send, withCors } from '../_lib/auth.js'
import OpenAI from 'openai'

async function getApplicantSession(supabase, applicantId) {
  const { data } = await supabase
    .from('applicants')
    .select('session_id')
    .eq('id', applicantId)
    .single()
  return data?.session_id
}

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
  if (req.method !== 'POST') return err(res, 405, 'Method not allowed')

  try {
    const { user, supabase } = await requireUser(req)
    const sessionId = await getApplicantSession(supabase, id)
    if (!sessionId) return err(res, 404, 'Applicant not found')
    if (!await isMember(supabase, sessionId, user.id)) return err(res, 403, 'Not a member')

    // Fetch messages and system prompt in parallel
    const [messagesRes, aiConfigRes] = await Promise.all([
      supabase
        .from('messages')
        .select('sender_name, is_from_applicant, content, sent_at')
        .eq('applicant_id', id)
        .order('sent_at', { ascending: true }),
      supabase
        .from('ai_configs')
        .select('system_prompt')
        .eq('session_id', sessionId)
        .single(),
    ])

    const messages = messagesRes.data ?? []
    const userPrompt = aiConfigRes.data?.system_prompt || 'Rate this WG applicant from 1 to 5.'
    const systemPrompt = userPrompt + '\n\nRate this WG applicant from 1 to 5 and write a short comment based on their messages and the WG Instruction. Reply ONLY in JSON: {"rating": <1-5>, "comment": "<text>"}'

    // Build user message — show all messages as a readable transcript
    const transcript = messages.map(m =>
      `[${m.is_from_applicant ? 'Applicant' : 'WG'}] ${m.content}`
    ).join('\n')

    const userMessage = transcript || 'No messages available.'

    const openai = new OpenAI({
      baseURL: 'https://api.deepinfra.com/v1/openai',
      apiKey: process.env.DEEPINFRA_API_KEY,
    })

    const completion = await openai.chat.completions.create({
      model: 'moonshotai/Kimi-K2.5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    })

    const rawContent = completion.choices[0].message.content
    let rating = null
    let comment = ''

    try {
      const parsed = JSON.parse(rawContent)
      rating = Math.max(1, Math.min(5, Math.round(Number(parsed.rating))))
      comment = parsed.comment ?? ''
    } catch {
      // If AI didn't return valid JSON, store raw
      comment = rawContent
    }

    // Save AI rating
    const { error } = await supabase
      .from('ai_ratings')
      .upsert({
        applicant_id: id,
        rating,
        comment,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'applicant_id' })

    if (error) return err(res, 500, error.message)
    return send(res, 200, { rating, comment })
  } catch (e) {
    return err(res, 500, e.message)
  }
})
