import { createSignal } from 'solid-js'
import { A, useNavigate } from '@solidjs/router'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [error, setError] = createSignal('')
  const [loading, setLoading] = createSignal(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email(),
        password: password(),
      })
      if (err) throw err
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div class="w-full max-w-sm">
        <h1 class="text-white text-2xl font-bold mb-6 text-center">WG Gesucht Pro</h1>
        <div class="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <h2 class="text-white text-lg font-semibold mb-4">Sign in</h2>
          <form onSubmit={handleSubmit} class="flex flex-col gap-4">
            <div>
              <label class="block text-gray-400 text-sm mb-1">Email</label>
              <input
                type="email"
                value={email()}
                onInput={e => setEmail(e.target.value)}
                required
                class="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label class="block text-gray-400 text-sm mb-1">Password</label>
              <input
                type="password"
                value={password()}
                onInput={e => setPassword(e.target.value)}
                required
                class="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>
            {error() && <p class="text-red-400 text-sm">{error()}</p>}
            <button
              type="submit"
              disabled={loading()}
              class="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition-colors"
            >
              {loading() ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p class="text-gray-500 text-sm mt-4 text-center">
            No account?{' '}
            <A href="/register" class="text-blue-400 hover:text-blue-300">Register</A>
          </p>
        </div>
      </div>
    </div>
  )
}
