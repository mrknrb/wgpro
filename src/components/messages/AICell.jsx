import { createSignal, createEffect } from 'solid-js'
import { authFetch } from '../../lib/supabase.js'

export default function AICell(props) {
  // props: applicantId, initialRating, initialComment, expanded, onRated
  const [rating, setRating] = createSignal(props.initialRating ?? null)
  const [comment, setComment] = createSignal(props.initialComment ?? '')
  const [running, setRunning] = createSignal(false)

  createEffect(() => {
    setRating(props.initialRating ?? null)
    setComment(props.initialComment ?? '')
  })

  async function runAI() {
    setRunning(true)
    try {
      const result = await authFetch(`/api/applicants/${props.applicantId}/ai-rate`, { method: 'POST' })
      setRating(result.rating)
      setComment(result.comment)
      props.onRated?.({ rating: result.rating, comment: result.comment })
    } catch (err) {
      alert('AI error: ' + err.message)
    } finally {
      setRunning(false)
    }
  }

  const cellClass = `align-top border-r border-gray-800 px-2 py-2`

  return (
    <>
      {/* AI Rating cell */}
      <td class={`${cellClass} w-20`}>
        <div class={!props.expanded ? 'overflow-hidden max-h-6' : ''}>
          {rating() !== null ? (
            <span class="text-purple-400 text-sm font-semibold">{rating()}</span>
          ) : (
            <span class="text-gray-600 text-sm">—</span>
          )}
        </div>
      </td>
      {/* AI Comment + Run button */}
      <td class={`${cellClass} min-w-[200px]`}>
        <div class="flex flex-col gap-1">
          <div class={!props.expanded ? 'overflow-hidden max-h-6' : ''}>
            <span class="text-gray-300 text-sm whitespace-pre-wrap">{comment() || (rating() === null ? '' : '—')}</span>
          </div>
          <button
            onClick={runAI}
            disabled={running()}
            class="mt-1 self-start text-xs bg-purple-800 hover:bg-purple-700 disabled:opacity-50 text-white px-2 py-0.5 rounded transition-colors"
          >
            {running() ? 'Running...' : 'Run AI'}
          </button>
        </div>
      </td>
    </>
  )
}
