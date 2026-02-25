import { createSignal, createResource, createEffect, Show, For, createMemo } from 'solid-js'
import { authFetch } from '../../lib/supabase.js'
import DateSelect from '../../components/DateSelect.jsx'

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8) // 8..22

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function formatDayHeader(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
  const dayMonth = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
  return `${dayName} ${dayMonth}`
}

export default function Appointments(props) {
  const [startDate, setStartDate] = createSignal(todayStr())
  const [saving, setSaving] = createSignal(null)
  const [localAppointments, setLocalAppointments] = createSignal([])
  const [localAvailability, setLocalAvailability] = createSignal([])

  createEffect(() => {
    if (data()) {
      setLocalAppointments(data().allAppointments ?? [])
      setLocalAvailability(data().allAvailability ?? [])
    }
  })

  const weekDates = createMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(startDate(), i))
  )

  const [data] = createResource(startDate, async () => {
    const [members, applicants, allAvailability, allAppointments] = await Promise.all([
      authFetch(`/api/sessions/${props.sessionId}/members`),
      authFetch(`/api/sessions/${props.sessionId}/applicants?minimal=true`),
      authFetch(`/api/availability?session_id=${props.sessionId}`),
      authFetch(`/api/sessions/${props.sessionId}/appointments`),
    ])
    return { members, applicants, allAvailability: allAvailability ?? [], allAppointments: allAppointments ?? [] }
  })

  const members = () => data()?.members ?? []
  const applicants = () => data()?.applicants ?? []

  // availabilityMap[date][user_id][hour] = true
  const availabilityMap = createMemo(() => {
    const result = {}
    for (const row of localAvailability()) {
      if (!result[row.date]) result[row.date] = {}
      if (!result[row.date][row.user_id]) result[row.date][row.user_id] = {}
      result[row.date][row.user_id][row.hour] = true
    }
    return result
  })

  // appointmentsMap[date][hour] = row
  const appointmentsMap = createMemo(() => {
    const result = {}
    for (const row of localAppointments()) {
      if (!result[row.date]) result[row.date] = {}
      result[row.date][row.hour] = row
    }
    return result
  })

  const isCurrentUser = (userId) => userId === props.currentUser?.id

  async function toggleAvailability(date, hour) {
    const key = `${date}-${hour}`
    const userId = props.currentUser?.id
    const currently = availabilityMap()[date]?.[userId]?.[hour]
    // Optimistic update
    const prev = localAvailability()
    if (currently) {
      setLocalAvailability(prev.filter((r) => !(r.date === date && r.user_id === userId && r.hour === hour)))
    } else {
      setLocalAvailability([...prev, { date, user_id: userId, hour }])
    }
    setSaving(key)
    try {
      await authFetch('/api/availability', {
        method: 'POST',
        body: JSON.stringify({
          session_id: props.sessionId,
          date,
          hour,
          available: !currently,
        }),
      })
    } catch (e) {
      setLocalAvailability(prev) // revert on error
      alert(e.message)
    } finally {
      setSaving(null)
    }
  }

  async function bookApplicant(date, hour, applicantId) {
    // Optimistic update — avoids refetch resetting all dropdowns
    const prev = localAppointments()
    setLocalAppointments([
      ...prev.filter((a) => !(a.date === date && a.hour === hour)),
      ...(applicantId ? [{ date, hour, applicant_id: applicantId }] : []),
    ])
    setSaving(`book-${date}-${hour}`)
    try {
      await authFetch(`/api/sessions/${props.sessionId}/appointments`, {
        method: 'POST',
        body: JSON.stringify({
          date,
          hour,
          applicant_id: applicantId || null,
        }),
      })
    } catch (e) {
      setLocalAppointments(prev) // revert on error
      alert(e.message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div class="p-4">
      <Show when={data.error}>
        <p class="text-red-400 py-8 text-center">Error loading appointments.</p>
      </Show>

      {/* Week start picker */}
      <div class="flex items-center gap-4 mb-6">
        <label class="text-gray-400 text-sm font-medium">Week from:</label>
        <DateSelect value={startDate()} onInput={(e) => setStartDate(e.target.value)} />
        <Show when={data.loading}>
          <span class="text-gray-400 text-sm">Loading...</span>
        </Show>
      </div>

      <Show when={data()}>
        <div class="overflow-x-auto rounded-xl border border-gray-800">
          <table class="border-collapse text-sm" style="min-width: max-content">
            <thead>
              {/* Day header row */}
              <tr class="bg-gray-900 border-b border-gray-700">
                <th class="px-3 py-2 text-left text-gray-400 font-medium text-xs border-r border-gray-700 w-16 sticky left-0 bg-gray-900 z-10">
                  Time
                </th>
                <For each={weekDates()}>
                  {(date) => (
                    <th
                      colspan={members().length + 1}
                      class={`px-3 py-2 text-center font-medium text-xs border-r ${date === todayStr() ? 'border-blue-600 text-blue-300 bg-blue-950/40' : 'border-gray-600 text-gray-200'}`}
                    >
                      {formatDayHeader(date)}
                    </th>
                  )}
                </For>
              </tr>
              {/* Member sub-header row */}
              <tr class="bg-gray-800 border-b border-gray-700">
                <th class=" border-r border-gray-700 w-16 sticky left-0 bg-gray-800 z-10" />
                <For each={weekDates()}>
                  {(date) => (
                    <>
                      <For each={members()}>
                        {(member) => (
                          <th class={` text-center text-gray-400 font-medium text-xs border-r border-gray-700 min-w-10 ${date === todayStr() ? 'bg-blue-950/20' : ''}`}>
                            <div class="truncate max-w-17">{member.username}</div>
                            <Show when={isCurrentUser(member.user_id)}>
                              <div class="text-blue-400 text-xs font-normal">(you)</div>
                            </Show>
                          </th>
                        )}
                      </For>
                      <th class={`px-2 py-2 text-center text-gray-400 font-medium text-xs border-r border-gray-600 min-w-32.5 ${date === todayStr() ? 'bg-blue-950/20' : ''}`}>
                        Booked
                      </th>
                    </>
                  )}
                </For>
              </tr>
            </thead>
            <tbody>
              <For each={HOURS}>
                {(hour) => (
                  <tr class="border-b border-gray-800 last:border-0 hover:bg-gray-900/30">
                    {/* Sticky time column */}
                    <td class="px-3 py-2 text-gray-300 font-mono text-sm border-r border-gray-800 whitespace-nowrap sticky left-0 bg-gray-950 z-10">
                      {String(hour).padStart(2, '0')}:00
                    </td>

                    <For each={weekDates()}>
                      {(date) => {
                        const booked = () => appointmentsMap()[date]?.[hour]
                        const isToday = date === todayStr()
                        return (
                          <>
                            <For each={members()}>
                              {(member) => {
                                const isAvailable = () => availabilityMap()[date]?.[member.user_id]?.[hour]
                                const savingKey = `${date}-${hour}`
                                return (
                                  <td class={`  text-center border-r border-gray-800 ${isToday ? "bg-blue-950/10" : ""}`}>
                                    <Show when={isCurrentUser(member.user_id)} fallback={<div class={`w-3.5 h-3.5 rounded-full mx-auto ${isAvailable() ? "bg-green-500" : "bg-gray-700"}`} title={isAvailable() ? "Available" : "Not available"} />}>
                                      <button
                                        onClick={() => toggleAvailability(date, hour)}
                                        disabled={saving() === savingKey}
                                        class={`cursor-pointer w-6 h-6 rounded-full border-2 transition-all disabled:opacity-50 ${isAvailable() ? "bg-green-500 border-green-400" : "bg-transparent border-gray-600 hover:border-green-500"}`}
                                        title={isAvailable() ? "Available — click to unmark" : "Mark as available"}
                                      />
                                    </Show>
                                  </td>
                                )
                              }}
                            </For>
                            {/* Booking column */}
                            <td class={`px-2 py-1.5 border-r border-gray-600 ${isToday ? "bg-blue-950/10" : ""}`}>
                              <select
                                value={booked()?.applicant_id ?? ""}
                                onChange={(e) => bookApplicant(date, hour, e.target.value)}
                                disabled={saving() === `book-${date}-${hour}`}
                                class="bg-gray-800 cursor-pointer border border-gray-700 text-white text-xs rounded px-1.5 py-1 focus:outline-none focus:border-blue-500 w-full disabled:opacity-50"
                              >
                                <option value="">—</option>
                                <For each={applicants()}>{(applicant) => <option value={applicant.id}>{applicant.name || applicant.wg_conversation_id}</option>}</For>
                              </select>
                            </td>
                          </>
                        )
                      }}
                    </For>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <p class="text-gray-600 text-xs mt-3">
          Green = available. Click your cell to toggle. Select an applicant to book a slot. Today is highlighted in blue.
        </p>
      </Show>
    </div>
  )
}
