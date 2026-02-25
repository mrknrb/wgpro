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
    <tr class={`border-b border-gray-800 ${props.rowIndex % 2 === 0 ? "bg-gray-950" : "bg-gray-900/50"}`}>
      {/* Expand toggle button */}

      {/* Applicant info */}
      <td onClick={() => setExpanded((e) => !e)} class={`cursor-pointer border-r border-gray-800 px-3 py-2 align-top w-36 min-w-36 ${expanded() ? "bg-green-950" : ""}`}>
        <div class={!expanded() ? "overflow-hidden max-h-6" : " "}>
          <div class="flex items-center gap-2 mb-1">
            {applicant().photo_url && <img src={applicant().photo_url} alt="" class="w-6 h-6 rounded-full object-cover shrink-0" />}
            <p class="text-blue-400  text-sm font-medium truncate">{applicant().name || "Unknown"}</p>
          </div>
          {expanded() && newestMessageDate() && <p class="text-gray-600 text-xs">Last: {newestMessageDate()}</p>}
        </div>
      </td>

      {/* WG Gesucht conversation link */}
      <td class="border-r border-gray-800 px-2 py-2 align-top w-10 text-center">
        {applicant().wg_conversation_id && (
          <a
            href={`https://www.wg-gesucht.de/nachricht.html?nachrichten-id=${applicant().wg_conversation_id}&list=1`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open conversation on WG Gesucht"
            class="inline-block opacity-60 hover:opacity-100 transition-opacity"
          >
            <img src="https://www.wg-gesucht.de/assets/favicon/favicon_wg_gesucht.ico" alt="WG Gesucht" class="w-4 h-4" />
          </a>
        )}
      </td>

      {/* Messages nested table */}
      <td class="border-r border-gray-800 px-0 py-0 align-top min-w-80 max-w-125">
        <div class={!expanded() ? "overflow-hidden max-h-7" : ""}>
          <NestedMessages messages={messages()} expanded={expanded()} />
        </div>
      </td>

      {/* Own rating + comment (private) */}
      <RatingCell applicantId={applicant().id} userId={props.currentUserId} currentUserId={props.currentUserId} initialRating={ownRating().rating ?? ""} initialComment={ownRating().comment ?? ""} expanded={expanded()} />

      {/* Favourites (public — shows all members) */}
      <FavouriteCell applicantId={applicant().id} members={props.members} currentUserId={props.currentUserId} favourites={applicant().favourites ?? []} expanded={expanded()} />
    </tr>
  )
}
