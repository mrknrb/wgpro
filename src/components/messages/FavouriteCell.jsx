import { createSignal, For, createMemo } from 'solid-js'
import { authFetch } from '../../lib/supabase.js'

export default function FavouriteCell(props) {
  // props: applicantId, members, currentUserId, favourites (string[]), expanded
  const [optimistic, setOptimistic] = createSignal(null) // null = use server state
  const [saving, setSaving] = createSignal(false)

  const favList = () => optimistic() ?? props.favourites
  const isFav = (userId) => favList().includes(userId)

  const favMembers = createMemo(() =>
    props.members.filter(m => isFav(m.user_id))
  )

  async function toggle() {
    if (saving()) return
    const current = isFav(props.currentUserId)
    const next = !current
    const prev = optimistic() ?? props.favourites
    setOptimistic(next
      ? [...prev, props.currentUserId]
      : prev.filter(id => id !== props.currentUserId)
    )
    setSaving(true)
    try {
      await authFetch(`/api/applicants/${props.applicantId}/favourite`, {
        method: 'PUT',
        body: JSON.stringify({ favourite: next }),
      })
    } catch (err) {
      console.error(err)
      setOptimistic(prev)
    } finally {
      setSaving(false)
    }
  }

  const mine = () => isFav(props.currentUserId)

  return (
    <td class="px-3 py-2 align-top min-w-80">
      <div class="flex items-start gap-2">
        {/* Toggle heart — always visible */}
        <button
          onClick={toggle}
          disabled={saving()}
          title={mine() ? "Remove from favourites" : "Mark as favourite"}
          class={`text-xl leading-none shrink-0 transition-colors disabled:opacity-60 ${mine() ? "text-red-500 hover:text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]" : "text-gray-600 hover:text-red-500"}`}
        >
          ♥
        </button>

        {/* Names of everyone who has favourited */}
        <div class="flex flex-wrap gap-1 items-center">
          <For each={favMembers()}>
            {(member) => <span class={`text-xs px-1.5 py-0.5 rounded font-medium ${member.user_id === props.currentUserId ? "bg-red-900/50 text-red-300 ring-1 ring-red-700/40" : "bg-purple-900/50 text-purple-300 ring-1 ring-purple-700/40"}`}>{member.username ?? member.email?.split("@")[0]}</span>}
          </For>
        </div>
      </div>
    </td>
  )
}
