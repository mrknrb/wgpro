import { createSignal, createResource, Show, For, createMemo } from 'solid-js'
import { authFetch } from '../../lib/supabase.js'

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8) // 8..22

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function Appointments(props) {
  const [selectedDate, setSelectedDate] = createSignal(todayStr())
  const [saving, setSaving] = createSignal(null)

  const [data, { refetch }] = createResource(async () => {
    const [members, applicants, availability, appointments] = await Promise.all([
      authFetch(`/api/sessions/${props.sessionId}/members`),
      authFetch(`/api/sessions/${props.sessionId}/applicants?minimal=true`),
      authFetch(`/api/availability?session_id=${props.sessionId}&date=${selectedDate()}`),
      authFetch(`/api/sessions/${props.sessionId}/appointments?date=${selectedDate()}`),
    ])
    return { members, applicants, availability, appointments }
  })

  // Re-fetch when date changes
  const dateSignal = () => selectedDate()
  createMemo(() => {
    dateSignal()
    refetch()
  })

  const members = () => data()?.members ?? []
  const applicants = () => data()?.applicants ?? []

  // availability[user_id][hour] = true
  const availabilityMap = createMemo(() => {
    const map = {}
    for (const row of data()?.availability ?? []) {
      if (!map[row.user_id]) map[row.user_id] = {}
      map[row.user_id][row.hour] = true
    }
    return map
  })

  // appointments[hour] = { applicant_id, applicant_name }
  const appointmentsMap = createMemo(() => {
    const map = {}
    for (const row of data()?.appointments ?? []) {
      map[row.hour] = row
    }
    return map
  })

  const isCurrentUser = (userId) => userId === props.currentUser?.id

  async function toggleAvailability(hour) {
    const key = `${hour}`
    setSaving(key)
    const currently = availabilityMap()[props.currentUser?.id]?.[hour]
    try {
      await authFetch('/api/availability', {
        method: 'POST',
        body: JSON.stringify({
          session_id: props.sessionId,
          date: selectedDate(),
          hour,
          available: !currently,
        }),
      })
      refetch()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(null)
    }
  }

  async function bookApplicant(hour, applicantId) {
    setSaving(`book-${hour}`)
    try {
      await authFetch(`/api/sessions/${props.sessionId}/appointments`, {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate(),
          hour,
          applicant_id: applicantId || null,
        }),
      })
      refetch()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div class="p-4">
      <Show when={data.error}>
        <p class="text-red-400 py-8 text-center">Error loading appointments.</p>
      </Show>

      {/* Date picker */}
      <div class="flex items-center gap-4 mb-6">
        <label class="text-gray-400 text-sm font-medium">Date:</label>
        <input type="date" value={selectedDate()} min={todayStr()} onInput={(e) => setSelectedDate(e.target.value)} class="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
        <Show when={data.loading}>
          <p class="text-gray-400 text-center">Loading...</p>
        </Show>
      </div>

      <Show when={data()}>
        <div class="overflow-x-auto rounded-xl border border-gray-800">
          <table class="min-w-full border-collapse text-sm">
            <thead>
              <tr class="bg-gray-800 border-b border-gray-700">
                <th class="px-3 py-2 text-left text-gray-400 font-medium text-xs border-r border-gray-700 w-16">Time</th>
                <For each={members()}>
                  {(member) => (
                    <th class="px-3 py-2 text-center text-gray-400 font-medium text-xs border-r border-gray-700 min-w-[100px]">
                      <div class="truncate">{member.email?.split("@")[0]}</div>
                      {isCurrentUser(member.user_id) && <div class="text-blue-400 text-xs font-normal">(you)</div>}
                    </th>
                  )}
                </For>
                <th class="px-3 py-2 text-center text-gray-400 font-medium text-xs min-w-[160px]">Booked Applicant</th>
              </tr>
            </thead>
            <tbody>
              <For each={HOURS}>
                {(hour) => {
                  const booked = () => appointmentsMap()[hour]
                  return (
                    <tr class="border-b border-gray-800 last:border-0 hover:bg-gray-900/50">
                      {/* Time slot */}
                      <td class="px-3 py-2 text-gray-300 font-mono text-sm border-r border-gray-800 whitespace-nowrap">{String(hour).padStart(2, "0")}:00</td>

                      {/* Member availability cells */}
                      <For each={members()}>
                        {(member) => {
                          const isAvailable = () => availabilityMap()[member.user_id]?.[hour]
                          return (
                            <td class="px-3 py-2 text-center border-r border-gray-800">
                              {isCurrentUser(member.user_id) ? (
                                <button
                                  onClick={() => toggleAvailability(hour)}
                                  disabled={saving() === String(hour)}
                                  class={`w-7 h-7 rounded-full border-2 transition-all disabled:opacity-50 ${isAvailable() ? "bg-green-500 border-green-400" : "bg-transparent border-gray-600 hover:border-green-500"}`}
                                  title={isAvailable() ? "Available (click to unmark)" : "Mark as available"}
                                />
                              ) : (
                                <div class={`w-4 h-4 rounded-full mx-auto ${isAvailable() ? "bg-green-500" : "bg-gray-700"}`} title={isAvailable() ? "Available" : "Not available"} />
                              )}
                            </td>
                          )
                        }}
                      </For>

                      {/* Booked applicant column */}
                      <td class="px-3 py-2">
                        <div class="flex items-center gap-2">
                          <select
                            value={booked()?.applicant_id ?? ""}
                            onChange={(e) => bookApplicant(hour, e.target.value)}
                            disabled={saving() === `book-${hour}`}
                            class="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500 flex-1 disabled:opacity-50"
                          >
                            <option value="">— No booking —</option>
                            <For each={applicants()}>{(applicant) => <option value={applicant.id}>{applicant.name || applicant.wg_conversation_id}</option>}</For>
                          </select>
                          {saving() === `book-${hour}` && <span class="text-gray-500 text-xs">Saving...</span>}
                        </div>
                      </td>
                    </tr>
                  )
                }}
              </For>
            </tbody>
          </table>
        </div>

        <p class="text-gray-600 text-xs mt-3">Green circle = available. Click your own cell to toggle availability. Select an applicant in the last column to book them into that slot.</p>
      </Show>
    </div>
  )
}
