import { createSignal, createResource, Show } from 'solid-js'
import { A, useNavigate } from '@solidjs/router'
import { supabase } from '../lib/supabase.js'

export default function Navbar() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = createSignal(false)

  const [user] = createResource(async () => {
    const { data } = await supabase.auth.getUser()
    return data.user
  })

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <nav class="bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
      <A href="/" class="text-white font-bold text-lg tracking-tight">WGPro</A>

      {/* Desktop nav */}
      <div class="hidden sm:flex items-center gap-4">
        <Show when={user()} fallback={
          <>
            <A href="/login" class="text-gray-300 hover:text-white text-sm">Login</A>
            <A href="/register" class="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded">Register</A>
          </>
        }>
          <span class="text-gray-400 text-sm">{user()?.email}</span>
          <button
            onClick={logout}
            class="text-gray-300 hover:text-white text-sm border border-gray-600 px-3 py-1.5 rounded hover:border-gray-400 transition-colors"
          >
            Logout
          </button>
        </Show>
      </div>

      {/* Mobile hamburger */}
      <button
        class="sm:hidden text-gray-300 hover:text-white p-2"
        onClick={() => setMenuOpen(o => !o)}
        aria-label="Toggle menu"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <Show when={menuOpen()} fallback={
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          }>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </Show>
        </svg>
      </button>

      {/* Mobile menu */}
      <Show when={menuOpen()}>
        <div class="absolute top-full left-0 right-0 bg-gray-900 border-b border-gray-700 px-4 py-3 flex flex-col gap-3 sm:hidden">
          <Show when={user()} fallback={
            <>
              <A href="/login" class="text-gray-300 hover:text-white text-sm" onClick={() => setMenuOpen(false)}>Login</A>
              <A href="/register" class="text-blue-400 hover:text-blue-300 text-sm" onClick={() => setMenuOpen(false)}>Register</A>
            </>
          }>
            <span class="text-gray-400 text-sm">{user()?.email}</span>
            <button onClick={logout} class="text-left text-gray-300 hover:text-white text-sm">Logout</button>
          </Show>
        </div>
      </Show>
    </nav>
  )
}
