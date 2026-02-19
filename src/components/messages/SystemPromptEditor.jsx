import { createSignal, createEffect } from "solid-js"
import { authFetch } from "../../lib/supabase.js"

export default function SystemPromptEditor(props) {
  const [prompt, setPrompt] = createSignal("")
  const [saving, setSaving] = createSignal(false)
  const [saved, setSaved] = createSignal(false)

  createEffect(() => {
    if (props.value) setPrompt(props.value)
  })

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      await authFetch(`/api/sessions/${props.sessionId}/ai-config`, {
        method: "PUT",
        body: JSON.stringify({ system_prompt: prompt() }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      props.onSave?.(prompt())
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div class="mb-4 bg-gray-900 border border-gray-700 rounded-xl p-4">
      <div class="flex items-center justify-between mb-2">
        <label class="text-gray-300 text-sm font-semibold">AI System Prompt</label>
        <button onClick={save} disabled={saving()} class="text-xs bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white px-3 py-1 rounded transition-colors">
          {saving() ? "Saving..." : saved() ? "Saved!" : "Save Prompt"}
        </button>
      </div>
      <textarea value={prompt()} onInput={(e) => setPrompt(e.target.value)} rows={3} class="w-full bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500  font-mono" placeholder="Enter the AI system prompt..." />
      <p class="text-gray-600 text-xs mt-1">The AI will receive all messages from an applicant as user input, and reply with a JSON rating.</p>
    </div>
  )
}
