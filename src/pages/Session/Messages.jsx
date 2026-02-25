import { createSignal, createResource, Show, For, createMemo } from 'solid-js'
import { authFetch } from '../../lib/supabase.js'
import ApplicantRow from '../../components/messages/ApplicantRow.jsx'

export default function Messages(props) {
  const [sortBy, setSortBy] = createSignal('newest') // 'newest' | 'myrating'

  const [data] = createResource(async () => {
    const [applicants, members] = await Promise.all([
      authFetch(`/api/sessions/${props.sessionId}/applicants`),
      authFetch(`/api/sessions/${props.sessionId}/members`),
    ])
    return { applicants, members }
  })

  const members = () => data()?.members ?? []

  const sortedApplicants = createMemo(() => {
    const list = data()?.applicants ?? []
    if (sortBy() === 'myrating') {
      return [...list].sort((a, b) => {
        const rA = a.ratings?.[props.currentUser?.id]?.rating ?? -1
        const rB = b.ratings?.[props.currentUser?.id]?.rating ?? -1
        return rB - rA
      })
    }
    // newest message
    return [...list].sort((a, b) => {
      const dateA = newestMsg(a)
      const dateB = newestMsg(b)
      return dateB - dateA
    })
  })

  function newestMsg(applicant) {
    const dates = (applicant.messages ?? []).map(m => m.sent_at ? new Date(m.sent_at).getTime() : 0)
    return dates.length ? Math.max(...dates) : 0
  }

  return (
    <div class="p-4">
      <Show when={data.loading}>
        <p class="text-gray-400 py-8 text-center">Loading...</p>
      </Show>
      <Show when={data.error}>
        <p class="text-red-400 py-8 text-center">Error loading data.</p>
      </Show>
      <Show when={data()}>
        {/* Sort controls */}
        <div class="flex items-center gap-3 mb-4">
          <span class="text-gray-400 text-sm">Sort by:</span>
          <button
            onClick={() => setSortBy('newest')}
            class={`text-sm px-3 py-1 rounded transition-colors ${sortBy() === 'newest' ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white border border-gray-700'}`}
          >
            Newest Message
          </button>
          <button
            onClick={() => setSortBy('myrating')}
            class={`text-sm px-3 py-1 rounded transition-colors ${sortBy() === 'myrating' ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white border border-gray-700'}`}
          >
            My Rating
          </button>
          <span class="text-gray-600 text-xs ml-auto">{sortedApplicants().length} applicant{sortedApplicants().length !== 1 ? 's' : ''}</span>
        </div>

        <Show when={sortedApplicants().length === 0}>
          <div class="text-center py-16 text-gray-500">
            <p class="text-base mb-1">No applicants yet</p>
            <p class="text-sm">Use the Chrome extension to scrape messages from WG Gesucht.</p>
          </div>
        </Show>

        {/* The main scrollable table */}
        <Show when={sortedApplicants().length > 0}>
          <div class="overflow-x-auto rounded-xl border border-gray-800">
            <table class="min-w-full border-collapse text-sm">
              <thead>
                <tr class="bg-gray-800 border-b border-gray-700">
                  <th class="px-3 py-2 text-left text-gray-400 font-medium text-xs border-r border-gray-700 w-36">Applicant</th>
                  <th class="px-3 py-2 text-left text-gray-400 font-medium text-xs border-r border-gray-700 w-10">Chat</th>
                  <th class="px-3 py-2 text-left text-gray-400 font-medium text-xs border-r border-gray-700 min-w-[320px]">Messages</th>
                  <th class="px-2 py-2 text-left text-gray-400 font-medium text-xs border-r border-gray-700 w-28">Status</th>
                  <th class="px-2 py-2 text-left text-gray-400 font-medium text-xs border-r border-gray-700 w-28">Appointment</th>
                  <th class="px-2 py-2 text-center text-gray-400 font-medium text-xs border-r border-gray-700 w-20">My Rating</th>
                  <th class="px-2 py-2 text-left text-gray-400 font-medium text-xs border-r border-gray-700 min-w-40">My Comment</th>
                  <th class="px-3 py-2 text-left text-gray-400 font-medium text-xs min-w-32">Favourites</th>
                </tr>
              </thead>
              <tbody>
                <For each={sortedApplicants()}>
                  {(applicant, idx) => (
                    <ApplicantRow
                      applicant={applicant}
                      members={members()}
                      currentUserId={props.currentUser?.id}
                      rowIndex={idx()}
                    />
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </Show>
    </div>
  )
}
