import { createResource, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { supabase } from '../lib/supabase.js'

export default function ProtectedRoute(props) {
  const navigate = useNavigate()

  const [session] = createResource(async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      navigate('/login', { replace: true })
      return null
    }
    return data.session
  })

  return (
    <Show when={session()} fallback={
      <div class="flex items-center justify-center h-screen text-gray-400">Checking auth...</div>
    }>
      {props.children}
    </Show>
  )
}
