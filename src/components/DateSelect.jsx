import { createMemo, For } from 'solid-js'

const MONTHS = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember'
].map((name, i) => ({ name, val: String(i + 1).padStart(2, '0') }))

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
const YEARS = Array.from({ length: 6 }, (_, i) => String(2024 + i))

const sel = 'bg-gray-800 border border-gray-600 text-white rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500'

export default function DateSelect(props) {
  const parts = createMemo(() => {
    const [y = '', m = '', d = ''] = (props.value || '').split('-')
    return { y, m, d }
  })

  function emit(y, m, d) {
    props.onInput({ target: { value: (y && m && d) ? `${y}-${m}-${d}` : '' } })
  }

  return (
    <div class={`flex gap-2 ${props.class || ''}`}>
      <select value={parts().d} onChange={(e) => emit(parts().y, parts().m, e.target.value)} class={sel}>
        <option value="">Tag</option>
        <For each={DAYS}>{(d) => <option value={d}>{d}</option>}</For>
      </select>
      <select value={parts().m} onChange={(e) => emit(parts().y, e.target.value, parts().d)} class={sel}>
        <option value="">Monat</option>
        <For each={MONTHS}>{(m) => <option value={m.val}>{m.name}</option>}</For>
      </select>
      <select value={parts().y} onChange={(e) => emit(e.target.value, parts().m, parts().d)} class={`${sel} w-24`}>
        <option value="">Jahr</option>
        <For each={YEARS}>{(y) => <option value={y}>{y}</option>}</For>
      </select>
    </div>
  )
}
