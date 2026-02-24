import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_PUBLIC_KEY

export function getSupabase() {
  return createClient(supabaseUrl, supabaseKey)
}

export async function requireUser(req) {
  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) throw new Error('Unauthorized')

  const supabase = getSupabase()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new Error('Unauthorized')

  // Create a client with the user's JWT so RLS (auth.uid()) works correctly
  const authedSupabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  return { user: data.user, supabase: authedSupabase }
}

export function send(res, status, data) {
  res.status(status).json(data)
}

export function err(res, status, message) {
  res.status(status).json({ error: message })
}

export function withCors(handler) {
  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    if (req.method === 'OPTIONS') return res.status(200).end()
    return handler(req, res)
  }
}
