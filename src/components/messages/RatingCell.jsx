import { createSignal, createEffect } from 'solid-js'
import { authFetch } from '../../lib/supabase.js'

export default function RatingCell(props) {
  // props: applicantId, userId, currentUserId, initialRating, initialComment, expanded
  const isOwn = () => props.userId === props.currentUserId
  const [rating, setRating] = createSignal(props.initialRating ?? '')
  const [comment, setComment] = createSignal(props.initialComment ?? '')
  const [saving, setSaving] = createSignal(false)

  createEffect(() => {
    setRating(props.initialRating ?? '')
    setComment(props.initialComment ?? '')
  })

  async function save() {
    if (!isOwn()) return
    setSaving(true)
    try {
      await authFetch(`/api/applicants/${props.applicantId}/ratings`, {
        method: 'PUT',
        body: JSON.stringify({ rating: rating() === '' ? null : Number(rating()), comment: comment() }),
      })
      props.onSave?.({ rating: rating(), comment: comment() })
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const cellClass = `align-top border-r border-gray-800 px-2 py-2 min-w-[80px]`
  const collapsed = `overflow-hidden`

  return (
    <>
      {/* Rating cell */}
      <td class={`${cellClass} w-20`}>
        <div class={!props.expanded ? 'overflow-hidden max-h-6' : ''}>
          {isOwn() ? (
            <input
              type="number"
              min="1"
              max="5"
              value={rating()}
              onInput={e => setRating(e.target.value)}
              onBlur={save}
              disabled={saving()}
              class="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-0.5 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              placeholder="1–5"
            />
          ) : (
            <span class="text-white text-sm">{rating() !== '' ? rating() : '—'}</span>
          )}
        </div>
      </td>
      {/* Comment cell */}
      <td class={`${cellClass} min-w-[160px]`}>
        <div class={!props.expanded ? 'overflow-hidden max-h-6' : ''}>
          {isOwn() ? (
            <textarea
              value={comment()}
              onInput={e => setComment(e.target.value)}
              onBlur={save}
              disabled={saving()}
              rows={props.expanded ? 4 : 1}
              class="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-0.5 focus:outline-none focus:border-blue-500 resize-y disabled:opacity-50"
              placeholder="Comment..."
            />
          ) : (
            <span class="text-gray-300 text-sm whitespace-pre-wrap">{comment() || '—'}</span>
          )}
        </div>
      </td>
    </>
  )
}
