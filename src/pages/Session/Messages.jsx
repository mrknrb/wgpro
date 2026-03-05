import { createSignal, createResource, Show, For, createMemo, onCleanup } from 'solid-js'
import { authFetch } from '../../lib/supabase.js'
import ApplicantRow from '../../components/messages/ApplicantRow.jsx'

function AddApplicantModal(props) {
  const [name, setName] = createSignal('')
  const [url, setUrl] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal('')

  async function submit(e) {
    e.preventDefault()
    if (!name().trim()) return
    setLoading(true)
    setError('')
    try {
      await authFetch(`/api/sessions/${props.sessionId}/applicants`, {
        method: 'POST',
        body: JSON.stringify({ name: name().trim(), profile_url: url().trim() || undefined }),
      })
      props.onSuccess()
      props.onClose()
    } catch (err) {
      setError(err.message ?? 'Failed to add applicant')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={props.onClose}>
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 class="text-white font-semibold text-base mb-4">Add Applicant</h2>
        <form onSubmit={submit} class="flex flex-col gap-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Name <span class="text-red-400">*</span></label>
            <input
              type="text"
              value={name()}
              onInput={(e) => setName(e.target.value)}
              placeholder="Applicant name"
              class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              autofocus
            />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Link <span class="text-gray-600">(optional)</span></label>
            <input
              type="url"
              value={url()}
              onInput={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <Show when={error()}>
            <p class="text-red-400 text-xs">{error()}</p>
          </Show>
          <div class="flex gap-2 justify-end pt-1">
            <button type="button" onClick={props.onClose} class="text-sm px-3 py-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600">Cancel</button>
            <button type="submit" disabled={loading() || !name().trim()} class="text-sm px-3 py-1.5 rounded bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-50">
              {loading() ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const STATUS_ORDER = ['Applied', 'Appointment', 'Casting', 'AfterCasting', 'Accepted', 'Declined']

const SORT_OPTIONS = [
  { key: 'status-asc',       label: 'Status ↑' },
  { key: 'status-desc',      label: 'Status ↓' },
  { key: 'appointment-asc',  label: 'Appointment ↑' },
  { key: 'appointment-desc', label: 'Appointment ↓' },
  { key: 'newest-asc',       label: 'Newest Message ↑' },
  { key: 'newest-desc',      label: 'Newest Message ↓' },
  { key: 'rating-asc',       label: 'Rating ↑' },
  { key: 'rating-desc',      label: 'Rating ↓' },/*
  { key: 'favourites-asc',   label: 'Favourites ↑' },
  { key: 'favourites-desc',  label: 'Favourites ↓' },*/
]

const STORAGE_KEY = 'messages-sort'

function getSavedSort() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && SORT_OPTIONS.some(o => o.key === v)) return v
  } catch {}
  return 'newest-desc'
}

export default function Messages(props) {
  const [sortBy, setSortBy] = createSignal(getSavedSort())
  const [dropdownOpen, setDropdownOpen] = createSignal(false)
  const [addOpen, setAddOpen] = createSignal(false)

  const [data, { refetch }] = createResource(async () => {
    const [applicants, members] = await Promise.all([
      authFetch(`/api/sessions/${props.sessionId}/applicants`),
      authFetch(`/api/sessions/${props.sessionId}/members`),
    ])
    return { applicants, members }
  })

  const members = () => data()?.members ?? []

  // Track ratings saved in this session so the sort reflects real-time changes
  const [localRatings, setLocalRatings] = createSignal({})

  function setSort(key) {
    setSortBy(key)
    try { localStorage.setItem(STORAGE_KEY, key) } catch {}
    closeDropdown()
  }

  function openDropdown() {
    setDropdownOpen(true)
    setTimeout(() => document.addEventListener('click', closeDropdown), 0)
  }

  function closeDropdown() {
    setDropdownOpen(false)
    document.removeEventListener('click', closeDropdown)
  }

  onCleanup(() => document.removeEventListener('click', closeDropdown))

  function newestMsg(applicant) {
    const dates = (applicant.messages ?? []).map(m => m.sent_at ? new Date(m.sent_at).getTime() : 0)
    return dates.length ? Math.max(...dates) : 0
  }

  const sortedApplicants = createMemo(() => {
    const list = data()?.applicants ?? []
    const [field, dir] = sortBy().split('-')
    const mul = dir === 'asc' ? 1 : -1

    return [...list].sort((a, b) => {
      if (field === 'status') {
        const ia = STATUS_ORDER.indexOf(a.status ?? 'Applied')
        const ib = STATUS_ORDER.indexOf(b.status ?? 'Applied')
        return mul * (ia - ib)
      }
      if (field === 'appointment') {
        const ta = a.appointment ? new Date(a.appointment.date).getTime() + (a.appointment.hour ?? 0) * 3600000 : null
        const tb = b.appointment ? new Date(b.appointment.date).getTime() + (b.appointment.hour ?? 0) * 3600000 : null
        if (ta === null && tb === null) return 0
        if (ta === null) return 1
        if (tb === null) return -1
        return mul * (ta - tb)
      }
      if (field === 'newest') {
        return mul * (newestMsg(a) - newestMsg(b))
      }
      if (field === 'rating') {
        const userId = props.currentUser?.id
        const local = localRatings()
        const rA = a.id in local ? (local[a.id] ?? -1) : (a.ratings?.[userId]?.rating ?? -1)
        const rB = b.id in local ? (local[b.id] ?? -1) : (b.ratings?.[userId]?.rating ?? -1)
        return mul * (rA - rB)
      }
      if (field === 'favourites') {
        return mul * ((a.favourites ?? []).length - (b.favourites ?? []).length)
      }
      return 0
    })
  })

  const currentLabel = () => SORT_OPTIONS.find(o => o.key === sortBy())?.label ?? 'Sort'

  return (
    <div class="pt-2">
      <Show when={data.loading}>
        <p class="text-gray-400 py-8 text-center">Loading...</p>
      </Show>
      <Show when={data.error}>
        <p class="text-red-400 py-8 text-center">Error loading data.</p>
      </Show>
      <Show when={data()}>
        {/* Sort controls */}
        <div class="flex items-center gap-3 mb-4">
          <span class="text-gray-400 text-sm pl-2">Sort by:</span>
          <div class="relative">
            <button onClick={openDropdown} class="text-sm px-3 py-1 rounded bg-blue-700 text-white flex items-center gap-1.5">
              {currentLabel()} <span class="text-xs opacity-60">▾</span>
            </button>
            <Show when={dropdownOpen()}>
              <div class="absolute z-50 top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded shadow-xl min-w-42.5">
                <For each={SORT_OPTIONS}>
                  {(opt) => (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSort(opt.key)
                      }}
                      class={`block w-full text-left text-xs px-3 py-1.5 border-b border-gray-800/50 last:border-0 transition-colors ${sortBy() === opt.key ? "text-white bg-blue-800 font-semibold" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
                    >
                      {opt.label}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <button onClick={() => setAddOpen(true)} class="ml-auto text-sm px-3 py-1 rounded bg-gray-700 text-gray-200 hover:bg-gray-600">
            + Add Applicant
          </button>
          <span class="text-gray-600 text-xs">
            {sortedApplicants().length} applicant{sortedApplicants().length !== 1 ? "s" : ""}
          </span>
        </div>
        <Show when={addOpen()}>
          <AddApplicantModal sessionId={props.sessionId} onClose={() => setAddOpen(false)} onSuccess={refetch} />
        </Show>

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
                  <th class="px-3 py-2 text-left text-gray-400 font-medium text-xs border-r border-gray-700 min-w-[320px]">Messages</th>
                  <th class="px-2 py-2 text-left text-gray-400 font-medium text-xs border-r border-gray-700 w-28">Status</th>
                  <th class="px-2 py-2 text-left text-gray-400 font-medium text-xs border-r border-gray-700 w-28">Appointment</th>
                  <th class="px-2 py-2 text-center text-gray-400 font-medium text-xs border-r border-gray-700 w-20">Rating (private)</th>
                  <th class="px-2 py-2 text-left text-gray-400 font-medium text-xs border-r border-gray-700 min-w-40">Comment (private)</th>
                  {/* The main scrollable table <th class="px-3 py-2 text-left text-gray-400 font-medium text-xs min-w-32">Favourites</th>
                   */}{" "}
                </tr>
              </thead>
              <tbody>
                <For each={sortedApplicants()}>
                  {(applicant, idx) => <ApplicantRow applicant={applicant} members={members()} currentUserId={props.currentUser?.id} rowIndex={idx()} onRatingSaved={(r) => setLocalRatings((prev) => ({ ...prev, [applicant.id]: r.rating === "" ? null : Number(r.rating) }))} />}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </Show>
    </div>
  )
}
