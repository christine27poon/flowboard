import { lazy, Suspense } from 'react'
import { useSession } from './auth'
import { AuthScreen } from './components/AuthScreen'
import { SetupNotice } from './components/SetupNotice'
import { isSupabaseConfigured } from './data/supabase'

// The workspace (boards, Home, forms) is only needed after sign-in, so the sign-in screen
// doesn't have to download it.
const loadWorkspace = () =>
  import('./components/WorkspaceView').then((m) => ({ default: m.WorkspaceView }))
const WorkspaceView = lazy(loadWorkspace)

/** Supabase keeps a signed-in session in localStorage under sb-<project>-auth-token. */
function hasStoredSession(): boolean {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
  } catch {
    return false
  }
}
// Returning users are about to need the workspace; fetch it alongside the session check.
if (hasStoredSession()) void loadWorkspace()

const loadingScreen = (
  <main>
    <p className="state" role="status">
      Loading…
    </p>
  </main>
)

export default function App() {
  return isSupabaseConfigured ? <AuthGate /> : <SetupNotice />
}

function AuthGate() {
  const { session, loading } = useSession()

  if (loading) return loadingScreen
  if (!session) return <AuthScreen />
  // Keyed by user so nothing carries over if someone else signs in on the same tab.
  return (
    <Suspense fallback={loadingScreen}>
      <WorkspaceView key={session.user.id} user={session.user} />
    </Suspense>
  )
}
