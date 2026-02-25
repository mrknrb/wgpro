import { createSignal, onCleanup } from 'solid-js'
import { authFetch } from '../../lib/supabase.js'

const STATUSES = ['Applied', 'Appointment', 'Casting', 'AfterCasting', 'Accepted', 'Declined']

const STATUS_STYLES = {
  Applied:      'bg-blue-900/60 text-blue-300 border-blue-700/50',
  Appointment:  'bg-green-900/60 text-green-300 border-green-700/50',
  Casting:      'bg-purple-900/60 text-purple-300 border-purple-700/50',
  AfterCasting: 'bg-orange-900/60 text-orange-300 border-orange-700/50',
  Accepted:     'bg-emerald-900/60 text-emerald-300 border-emerald-700/50',
  Declined:     'bg-red-900/60 text-red-300 border-red-700/50',
}

export default function StatusCell(props) {
  // props: applicantId, initialStatus
  const [status, setStatus] = createSignal(props.initialStatus ?? 'Applied')
  const [open, setOpen] = createSignal(false)
  const [saving, setSaving] = createSignal(false)

  function openDropdown() {
    setOpen(true)
    setTimeout(() => document.addEventListener('click', closeOnOutside), 0)
  }

  function closeOnOutside() {
    setOpen(false)
    document.removeEventListener('click', closeOnOutside)
  }

  onCleanup(() => document.removeEventListener('click', closeOnOutside))

  async function select(e, s) {
    e.stopPropagation()
    setOpen(false)
    document.removeEventListener('click', closeOnOutside)
    if (s === status()) return
    const prev = status()
    setStatus(s)
    setSaving(true)
    try {
      await authFetch(`/api/applicants/${props.applicantId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: s }),
      })
    } catch (err) {
      console.error(err)
      setStatus(prev)
    } finally {
      setSaving(false)
    }
  }

  return (
    <td class="border-r border-gray-800 px-2 py-2 align-top w-28 relative">
      <button
        onClick={openDropdown}
        disabled={saving()}
        class={`text-xs px-2 py-0.5 rounded border font-medium w-full text-left transition-opacity disabled:opacity-50 ${STATUS_STYLES[status()] ?? STATUS_STYLES['Applied']}`}
      >
        {status()}
      </button>
      {open() && (
        <div class="absolute z-50 top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded shadow-xl min-w-[120px]">
          {STATUSES.map(s => (
            <button
              onClick={e => select(e, s)}
              class={`block w-full text-left text-xs px-3 py-1.5 hover:bg-gray-700 transition-colors ${s === status() ? 'text-white font-semibold' : 'text-gray-300'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </td>
  )
}
