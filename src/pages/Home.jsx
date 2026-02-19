import { createSignal, createResource, Show, For } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import Navbar from '../components/Navbar.jsx'
import { authFetch, supabase } from '../lib/supabase.js'

export default function Home() {
  const navigate = useNavigate()
  const [showModal, setShowModal] = createSignal(false)
  const [sessionName, setSessionName] = createSignal('')
  const [adUrl, setAdUrl] = createSignal('')
  const [creating, setCreating] = createSignal(false)
  const [createError, setCreateError] = createSignal('')

  const [sessions, { refetch }] = createResource(async () => {
    return authFetch('/api/sessions')
  })

  async function createSession(e) {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      await authFetch('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ name: sessionName(), ad_url: adUrl() }),
      })
      setShowModal(false)
      setSessionName('')
      setAdUrl('')
      refetch()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div class="min-h-screen bg-gray-950">
      <Navbar />
      <main class="max-w-4xl mx-auto px-4 py-8">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-white text-2xl font-bold">My Sessions</h1>
          <button
            onClick={() => setShowModal(true)}
            class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
          >
            + New Session
          </button>
        </div>

        <Show when={sessions.loading}>
          <p class="text-gray-400">Loading sessions...</p>
        </Show>

        <Show when={sessions.error}>
          <p class="text-red-400">Error: {sessions.error.message}</p>
        </Show>

        <Show when={sessions() && sessions().length === 0}>
          <div class="text-center py-16 text-gray-500">
            <p class="text-lg mb-2">No sessions yet</p>
            <p class="text-sm">Create a new session for each WG Gesucht ad you manage.</p>
          </div>
        </Show>

        <div class="grid gap-4 sm:grid-cols-2">
          <For each={sessions()}>
            {(session) => (
              <button
                onClick={() => navigate(`/session/${session.id}`)}
                class="text-left bg-gray-900 border border-gray-700 hover:border-blue-500 rounded-xl p-5 transition-colors group"
              >
                <h3 class="text-white font-semibold text-base group-hover:text-blue-400 transition-colors mb-1">
                  {session.name}
                </h3>
                <p class="text-gray-500 text-xs mb-3">Created {formatDate(session.created_at)}</p>
                <div class="flex items-center gap-3 text-xs text-gray-400">
                  <span>{session.member_count ?? 0} member{session.member_count !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span>{session.applicant_count ?? 0} applicant{session.applicant_count !== 1 ? 's' : ''}</span>
                  {session.is_admin && (
                    <>
                      <span>·</span>
                      <span class="text-yellow-500">Admin</span>
                    </>
                  )}
                </div>
              </button>
            )}
          </For>
        </div>
      </main>

      {/* Create Session Modal */}
      <Show when={showModal()}>
        <div
          class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h2 class="text-white font-bold text-lg mb-4">New Session</h2>
            <form onSubmit={createSession} class="flex flex-col gap-4">
              <div>
                <label class="block text-gray-400 text-sm mb-1">Session name</label>
                <input
                  type="text"
                  value={sessionName()}
                  onInput={e => setSessionName(e.target.value)}
                  required
                  class="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Wohnung Mitte 3-Zimmer"
                />
              </div>
              <div>
                <label class="block text-gray-400 text-sm mb-1">WG Gesucht ad URL <span class="text-gray-600">(optional)</span></label>
                <input
                  type="url"
                  value={adUrl()}
                  onInput={e => setAdUrl(e.target.value)}
                  class="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="https://www.wg-gesucht.de/..."
                />
              </div>
              {createError() && <p class="text-red-400 text-sm">{createError()}</p>}
              <div class="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  class="text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating()}
                  class="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  {creating() ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  )
}
