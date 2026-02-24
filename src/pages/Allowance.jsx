import { createSignal, createResource, Show, For } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import Navbar from '../components/Navbar.jsx'
import { authFetch } from '../lib/supabase.js'

export default function Allowance() {
  const params = useParams()
  const navigate = useNavigate()
  const [processing, setProcessing] = createSignal(null)
  const [adUrl, setAdUrl] = createSignal('')
  const [cutoffDate, setCutoffDate] = createSignal('')
  const [savingAdUrl, setSavingAdUrl] = createSignal(false)
  const [adUrlError, setAdUrlError] = createSignal('')
  const [adUrlSaved, setAdUrlSaved] = createSignal(false)
  const [aiPrompt, setAiPrompt] = createSignal('')
  const [savingPrompt, setSavingPrompt] = createSignal(false)
  const [promptSaved, setPromptSaved] = createSignal(false)
  const [promptError, setPromptError] = createSignal('')

  const [session, { refetch: refetchSession }] = createResource(async () => {
    const [s, aiConfig] = await Promise.all([
      authFetch(`/api/sessions/${params.id}`),
      authFetch(`/api/sessions/${params.id}/ai-config`),
    ])
    setAdUrl(s.ad_url || '')
    setCutoffDate(s.scrape_cutoff_date || '')
    setAiPrompt(aiConfig?.system_prompt ?? '')
    return s
  })

  const [requests, { refetch }] = createResource(async () => {
    return authFetch(`/api/sessions/${params.id}/approve`)
  })

  const [members, { refetch: refetchMembers }] = createResource(async () => {
    return authFetch(`/api/sessions/${params.id}/members`)
  })

  async function saveAdUrl(e) {
    e.preventDefault()
    setAdUrlError('')
    setAdUrlSaved(false)
    setSavingAdUrl(true)
    try {
      await authFetch(`/api/sessions/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ad_url: adUrl(), scrape_cutoff_date: cutoffDate() || null }),
      })
      setAdUrlSaved(true)
      refetchSession()
    } catch (err) {
      setAdUrlError(err.message)
    } finally {
      setSavingAdUrl(false)
    }
  }

  async function decide(requestId, status) {
    setProcessing(requestId)
    try {
      await authFetch(`/api/sessions/${params.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ request_id: requestId, status }),
      })
      refetch()
      refetchMembers()
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessing(null)
    }
  }

  async function toggleAdmin(userId, isAdmin) {
    try {
      await authFetch(`/api/sessions/${params.id}/members`, {
        method: 'PATCH',
        body: JSON.stringify({ user_id: userId, is_admin: !isAdmin }),
      })
      refetchMembers()
    } catch (err) {
      alert(err.message)
    }
  }

  async function copyInviteLink() {
    try {
      const data = await authFetch(`/api/sessions/${params.id}/invite`, { method: 'POST' })
      const link = `${window.location.origin}/session/${params.id}/join?token=${data.token}`
      await navigator.clipboard.writeText(link)
      alert('Invite link copied to clipboard!')
    } catch (err) {
      alert(err.message)
    }
  }

  async function saveAiPrompt() {
    setPromptError('')
    setPromptSaved(false)
    setSavingPrompt(true)
    try {
      await authFetch(`/api/sessions/${params.id}/ai-config`, {
        method: 'PUT',
        body: JSON.stringify({ system_prompt: aiPrompt() }),
      })
      setPromptSaved(true)
      setTimeout(() => setPromptSaved(false), 2000)
    } catch (e) {
      setPromptError(e.message)
    } finally {
      setSavingPrompt(false)
    }
  }

  return (
    <div class="min-h-screen bg-gray-950">
      <Navbar />
      <main class="max-w-3xl mx-auto px-4 py-8">
        <div class="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(`/session/${params.id}`)} class="text-gray-400 hover:text-white text-sm">
            ← Back
          </button>
          <h1 class="text-white text-2xl font-bold">Settings</h1>
        </div>

        {/* Session Settings */}
        <div class="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6">
          <h2 class="text-white font-semibold mb-3">Session Settings</h2>
          <form onSubmit={saveAdUrl} class="flex flex-col gap-3">
            <div>
              <label class="block text-gray-400 text-sm mb-1">WG Gesucht ad URL</label>
              <input type="url" value={adUrl()} onInput={(e) => setAdUrl(e.target.value)} placeholder="https://www.wg-gesucht.de/..." class="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              <p class="text-gray-600 text-xs mt-1">The ad ID is extracted automatically from the URL.</p>
            </div>
            <div>
              <label class="block text-gray-400 text-sm mb-1">Scrape cutoff date</label>
              <input type="date" value={cutoffDate()} onInput={(e) => setCutoffDate(e.target.value)} class="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              <p class="text-gray-600 text-xs mt-1">The extension stops scraping conversations with no messages after this date. Leave empty to scrape all.</p>
            </div>
            {adUrlError() && <p class="text-red-400 text-sm">{adUrlError()}</p>}
            {adUrlSaved() && <p class="text-green-400 text-sm">Saved!</p>}
            <div>
              <button type="submit" disabled={savingAdUrl()} class="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                {savingAdUrl() ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>

        {/* Invite link */}
        <div class="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6">
          <h2 class="text-white font-semibold mb-3">Invite Link</h2>
          <p class="text-gray-400 text-sm mb-3">Generate a link that others can use to request access to this session.</p>
          <button onClick={copyInviteLink} class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            Generate & Copy Invite Link
          </button>
        </div>

        {/* Pending requests */}
        <div class="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6">
          <h2 class="text-white font-semibold mb-4">Pending Requests</h2>
          <Show when={requests.loading}>
            <p class="text-gray-400 text-sm">Loading...</p>
          </Show>
          <Show when={requests() && requests().length === 0}>
            <p class="text-gray-500 text-sm">No pending join requests.</p>
          </Show>
          <div class="flex flex-col gap-3">
            <For each={requests()}>
              {(req) => (
                <div class="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                  <div>
                    <p class="text-white text-sm font-medium">{req.user_email}</p>
                    <p class="text-gray-500 text-xs">{new Date(req.requested_at).toLocaleString("de-DE")}</p>
                  </div>
                  <div class="flex gap-2">
                    <button onClick={() => decide(req.id, "approved")} disabled={processing() === req.id} class="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
                      Approve
                    </button>
                    <button onClick={() => decide(req.id, "rejected")} disabled={processing() === req.id} class="bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>


        {/* Members list */}
        <div class="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h2 class="text-white font-semibold mb-4">Members</h2>
          <Show when={members.loading}>
            <p class="text-gray-400 text-sm">Loading...</p>
          </Show>
          <div class="flex flex-col gap-2">
            <For each={members()}>
              {(member) => (
                <div class="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white text-xs font-bold">{(member.email?.[0] ?? "?").toUpperCase()}</div>
                    <div>
                      <p class="text-white text-sm">{member.email}</p>
                      {member.is_admin && <span class="text-yellow-500 text-xs">Admin</span>}
                    </div>
                  </div>
                  <button onClick={() => toggleAdmin(member.user_id, member.is_admin)} class="text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 px-3 py-1.5 rounded transition-colors">
                    {member.is_admin ? "Remove admin" : "Make admin"}
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </main>
    </div>
  )
}
