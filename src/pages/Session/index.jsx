import { createResource, createEffect, Show } from 'solid-js'
import { useParams, useNavigate, A } from '@solidjs/router'
import Navbar from '../../components/Navbar.jsx'
import Messages from './Messages.jsx'
import Appointments from './Appointments.jsx'
import Allowance from '../Allowance.jsx'
import { authFetch, supabase } from '../../lib/supabase.js'

export default function SessionPage(props) {
  const params = useParams()
  const navigate = useNavigate()

  const [session] = createResource(async () => {
    return authFetch(`/api/sessions/${params.id}`)
  })

  const [currentUser] = createResource(async () => {
    const { data } = await supabase.auth.getUser()
    return data.user
  })

  createEffect(() => {
    if (session.error) navigate('/')
  })

  const isAdmin = () => session()?.is_admin

  return (
    <div class="min-h-screen bg-gray-950">
      <Navbar />
      <Show when={session.loading}>
        <div class="flex items-center justify-center py-20 text-gray-400">Loading session...</div>
      </Show>
      <Show when={session()}>
        <div class="border-b border-gray-800 bg-gray-900">
          <div class="max-w-full px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
             
              <h1 class="text-white font-bold text-base">{session()?.name}</h1>
            </div>
            <div class="flex items-center gap-2">
              <Show when={isAdmin()}>
                <A
                  href={`/session/${params.id}/allowance`}
                  class={`text-sm px-4 py-1.5 rounded transition-colors ${props.tab === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Settings
                </A>
              </Show>
              <A
                href={`/session/${params.id}`}
                class={`text-sm px-4 py-1.5 rounded transition-colors ${props.tab === 'messages' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Messages
              </A>
              <A
                href={`/session/${params.id}/appointments`}
                class={`text-sm px-4 py-1.5 rounded transition-colors ${props.tab === 'appointments' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Appointments
              </A>
            </div>
          </div>
        </div>

        <Show when={props.tab === 'messages'}>
          <Messages sessionId={params.id} currentUser={currentUser()} />
        </Show>
        <Show when={props.tab === 'appointments'}>
          <Appointments sessionId={params.id} currentUser={currentUser()} />
        </Show>
        <Show when={props.tab === 'settings'}>
          <Allowance />
        </Show>
      </Show>
    </div>
  )
}
