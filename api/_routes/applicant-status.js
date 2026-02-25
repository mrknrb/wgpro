import { requireUser, err, send, withCors } from '../_lib/auth.js'

const VALID_STATUSES = ['Declined', 'Applied', 'Appointment', 'Casting','AfterCasting', 'Accepted']

export default withCors(async function handler(req, res) {
  const { id } = req.query
  try {
    const { supabase } = await requireUser(req)

    if (req.method === 'PUT') {
      const { status } = req.body
      if (!VALID_STATUSES.includes(status)) return err(res, 400, 'Invalid status')

      const { error } = await supabase
        .from('applicants')
        .update({ status })
        .eq('id', id)

      if (error) return err(res, 500, error.message)
      return send(res, 200, { ok: true })
    }

    return err(res, 405, 'Method not allowed')
  } catch (e) {
    return err(res, 401, e.message)
  }
})
