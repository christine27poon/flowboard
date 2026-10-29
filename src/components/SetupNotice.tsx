/** Shown when the Supabase env vars are missing. */
export function SetupNotice() {
  return (
    <main className="auth">
      <div className="auth__card sheet">
        <h1>Almost there</h1>
        <p>
          Add your Supabase project details to <code>.env.local</code> and restart the dev server:
        </p>
        <pre className="auth__code">
          {'VITE_SUPABASE_URL=https://<project>.supabase.co\nVITE_SUPABASE_ANON_KEY=<publishable key>'}
        </pre>
        <p>
          Both values are in the Supabase dashboard under Project Settings → API. See{' '}
          <code>.env.example</code>.
        </p>
      </div>
    </main>
  )
}
