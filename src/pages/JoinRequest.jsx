import { createSignal, createResource, Show } from 'solid-js'
import { useParams, useSearchParams, useNavigate } from '@solidjs/router'
import { authFetch, supabase } from '../lib/supabase.js'

export default function JoinRequest() {
  const params = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const token = search.token

  const [requesting, setRequesting] = createSignal(false)
  const [done, setDone] = createSignal(false)
  const [error, setError] = createSignal('')

  const [sessionInfo] = createResource(async () => {
    if (!token) return null
    const res = await fetch(`/api/sessions/${params.id}/invite?token=${token}`)
    if (!res.ok) return null
    return res.json()
  })

  async function requestJoin() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      navigate(`/login?redirect=/session/${params.id}/join?token=${token}`)
      return
    }
    setRequesting(true)
    setError('')
    try {
      await authFetch(`/api/sessions/${params.id}/join`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div class="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div class="w-full max-w-sm">
        <h1 class="text-white text-2xl font-bold mb-6 text-center">WGPro</h1>
        <div class="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <Show when={!token}>
            <p class="text-red-400">Invalid invite link.</p>
          </Show>
          <Show when={token && sessionInfo.loading}>
            <p class="text-gray-400">Loading invite...</p>
          </Show>
          <Show when={token && !sessionInfo.loading && !sessionInfo()}>
            <p class="text-red-400">Invite link is invalid or expired.</p>
          </Show>
          <Show when={sessionInfo()}>
            <Show when={done()} fallback={
              <>
                <h2 class="text-white font-bold text-lg mb-2">You've been invited</h2>
                <p class="text-gray-400 text-sm mb-4">
                  Join the session <span class="text-white font-semibold">"{sessionInfo()?.name}"</span> to collaborate on WG applicant evaluation.
                </p>
                {error() && <p class="text-red-400 text-sm mb-3">{error()}</p>}
                <button
                  onClick={requestJoin}
                  disabled={requesting()}
                  class="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition-colors"
                >
                  {requesting() ? 'Requesting...' : 'Request to Join'}
                </button>
              </>
            }>
              <div class="text-center">
                <div class="text-green-400 text-4xl mb-3">✓</div>
                <h2 class="text-white font-bold text-lg mb-2">Request sent!</h2>
                <p class="text-gray-400 text-sm">The session admin will review your request. You'll be able to access it once approved.</p>
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  )
}
