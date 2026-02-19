import { Router, Route } from '@solidjs/router'
import { lazy, Suspense } from 'solid-js'
import ProtectedRoute from './components/ProtectedRoute.jsx'

const Login = lazy(() => import('./pages/Login.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const Home = lazy(() => import('./pages/Home.jsx'))
const JoinRequest = lazy(() => import('./pages/JoinRequest.jsx'))
const Allowance = lazy(() => import('./pages/Allowance.jsx'))
const SessionMessages = lazy(() => import('./pages/Session/index.jsx'))

function App() {
  return (
    <Router>
      <Suspense fallback={<div class="flex items-center justify-center h-screen text-gray-400">Loading...</div>}>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/session/:id/join" component={JoinRequest} />
        <Route
          path="/"
          component={() => (
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/session/:id"
          component={() => (
            <ProtectedRoute>
              <SessionMessages tab="messages" />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/session/:id/appointments"
          component={() => (
            <ProtectedRoute>
              <SessionMessages tab="appointments" />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/session/:id/allowance"
          component={() => (
            <ProtectedRoute>
              <Allowance />
            </ProtectedRoute>
          )}
        />
      </Suspense>
    </Router>
  )
}

export default App
