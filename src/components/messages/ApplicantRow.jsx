import { createSignal } from 'solid-js'
import NestedMessages from './NestedMessages.jsx'
import RatingCell from './RatingCell.jsx'
import FavouriteCell from './FavouriteCell.jsx'

export default function ApplicantRow(props) {
  // props: applicant, members, currentUserId, rowIndex
  const [expanded, setExpanded] = createSignal(false)

  const applicant = () => props.applicant
  const messages = () => applicant().messages ?? []
  const ratings = () => applicant().ratings ?? {}
  const ownRating = () => ratings()[props.currentUserId] ?? {}

  const newestMessageDate = () => {
    const dates = messages().map(m => m.sent_at).filter(Boolean)
    if (!dates.length) return null
    return new Date(Math.max(...dates.map(d => new Date(d)))).toLocaleDateString('de-DE')
  }

  return (
    <tr class={`border-b border-gray-800 ${props.rowIndex % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/50'}`}>
      {/* Expand toggle button */}
      <td class="border-r border-gray-800 px-2 py-2 align-top w-10 min-w-10">
        <button
          onClick={() => setExpanded(e => !e)}
          class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg"
          title={expanded() ? 'Collapse' : 'Expand'}
        >
          {expanded() ? '▲' : '▼'}
        </button>
      </td>

      {/* Applicant info */}
      <td class="border-r border-gray-800 px-3 py-2 align-top w-36 min-w-36">
        <div class={!expanded() ? 'overflow-hidden max-h-6' : ''}>
          <div class="flex items-center gap-2 mb-1">
            {applicant().photo_url && (
              <img src={applicant().photo_url} alt="" class="w-6 h-6 rounded-full object-cover shrink-0" />
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
      <td class="border-r border-gray-800 px-0 py-0 align-top min-w-80 max-w-125">
        <div class={!expanded() ? 'overflow-hidden max-h-7' : ''}>
          <NestedMessages messages={messages()} expanded={expanded()} />
        </div>
      </td>

      {/* Own rating + comment (private) */}
      <RatingCell
        applicantId={applicant().id}
        userId={props.currentUserId}
        currentUserId={props.currentUserId}
        initialRating={ownRating().rating ?? ''}
        initialComment={ownRating().comment ?? ''}
        expanded={expanded()}
      />

      {/* Favourites (public — shows all members) */}
      <FavouriteCell
        applicantId={applicant().id}
        members={props.members}
        currentUserId={props.currentUserId}
        favourites={applicant().favourites ?? []}
        expanded={expanded()}
      />
    </tr>
  )
}
