import { For } from 'solid-js'

export default function NestedMessages(props) {
  // props: messages (array), expanded
  function formatTime(ts) {
    if (!ts) return ''
    return new Date(ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <table class="w-full text-xs border-collapse">
      <tbody>
        <For each={props.messages}>
          {(msg) => (
            <tr class={`border-b border-gray-800 last:border-0 ${msg.is_from_applicant ? 'bg-transparent' : 'bg-gray-800/40'}`}>
              <td class="py-1 px-2 text-gray-500 whitespace-nowrap w-28 align-top">
                {formatTime(msg.sent_at)}
              </td>
              <td class="py-1 px-2 text-gray-400 whitespace-nowrap w-24 align-top font-medium">
                {msg.sender_name || (msg.is_from_applicant ? 'Applicant' : 'You')}
              </td>
              <td class={`py-1 px-2 text-gray-200 align-top ${!props.expanded ? 'overflow-hidden max-h-5 whitespace-nowrap' : 'whitespace-pre-wrap'}`}>
                <div class={!props.expanded ? 'overflow-hidden text-ellipsis whitespace-nowrap max-w-xs' : ''}>
                  {msg.content}
                </div>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  )
}
