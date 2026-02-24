import { createSignal, For, createEffect } from 'solid-js'
import NestedMessages from './NestedMessages.jsx'
import RatingCell from './RatingCell.jsx'

export default function ApplicantRow(props) {
  // props: applicant, members, currentUserId, rowIndex
  const [expanded, setExpanded] = createSignal(false)

  const applicant = () => props.applicant
  const messages = () => applicant().messages ?? []
  const ratings = () => applicant().ratings ?? {}
  const avgRating = () => {
    const vals = props.members
      .map(m => ratings()[m.user_id]?.rating)
      .filter(v => v != null && v !== '')
    if (!vals.length) return null
    return (vals.reduce((s, v) => s + Number(v), 0) / vals.length).toFixed(1)
  }

  const newestMessageDate = () => {
    const dates = messages().map(m => m.sent_at).filter(Boolean)
    if (!dates.length) return null
    return new Date(Math.max(...dates.map(d => new Date(d)))).toLocaleDateString('de-DE')
  }

  return (
    <tr class={`border-b border-gray-800 ${props.rowIndex % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/50'}`}>
      {/* Expand toggle button */}
      <td class="border-r border-gray-800 px-2 py-2 align-top w-10 min-w-[40px]">
        <button
          onClick={() => setExpanded(e => !e)}
          class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg"
          title={expanded() ? 'Collapse' : 'Expand'}
        >
          {expanded() ? '▲' : '▼'}
        </button>
      </td>

      {/* Applicant info */}
      <td class="border-r border-gray-800 px-3 py-2 align-top w-36 min-w-[144px]">
        <div class={!expanded() ? 'overflow-hidden max-h-6' : ''}>
          <div class="flex items-center gap-2 mb-1">
            {applicant().photo_url && (
              <img src={applicant().photo_url} alt="" class="w-6 h-6 rounded-full object-cover flex-shrink-0" />
            )}
            <a
              href={applicant().profile_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-400 hover:text-blue-300 text-sm font-medium truncate"
            >
              {applicant().name || 'Unknown'}
            </a>
          </div>
          {expanded() && newestMessageDate() && (
            <p class="text-gray-600 text-xs">Last: {newestMessageDate()}</p>
          )}
        </div>
      </td>

      {/* Messages nested table */}
      <td class="border-r border-gray-800 px-0 py-0 align-top min-w-[320px] max-w-[500px]">
        <div class={!expanded() ? 'overflow-hidden max-h-7' : ''}>
          <NestedMessages messages={messages()} expanded={expanded()} />
        </div>
      </td>

      {/* Per-member rating + comment columns */}
      <For each={props.members}>
        {(member) => (
          <RatingCell
            applicantId={applicant().id}
            userId={member.user_id}
            currentUserId={props.currentUserId}
            initialRating={ratings()[member.user_id]?.rating ?? ''}
            initialComment={ratings()[member.user_id]?.comment ?? ''}
            expanded={expanded()}
          />
        )}
      </For>

      {/* Average rating */}
      <td class="border-r border-gray-800 px-3 py-2 align-top w-16 text-center">
        <div class={!expanded() ? 'overflow-hidden max-h-6' : ''}>
          <span class={`text-sm font-bold ${avgRating() ? 'text-green-400' : 'text-gray-600'}`}>
            {avgRating() ?? '—'}
          </span>
        </div>
      </td>

    </tr>
  )
}
