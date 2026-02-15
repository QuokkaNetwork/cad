export default function Login() {
  return (
    <div className="min-h-screen bg-cad-bg flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Sillitoe bar */}
        <div className="sillitoe-bar rounded-t-lg" />

        <div className="bg-cad-surface border border-cad-border border-t-0 rounded-b-lg p-8 text-center">
          {/* Badge / Title */}
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-vicpol-navy flex items-center justify-center">
              <svg className="w-10 h-10 text-cad-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-cad-gold tracking-wide">
              Emergency Services CAD
            </h1>
            <p className="text-sm text-cad-muted mt-1">
              Computer Aided Dispatch
            </p>
          </div>

          {/* Login button */}
          <a
            href="/api/auth/steam"
            className="inline-flex items-center gap-3 px-6 py-3 bg-[#171a21] hover:bg-[#2a475e] border border-[#2a475e] rounded-lg text-white font-medium transition-colors w-full justify-center"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.979 0C5.678 0 .511 4.86.022 10.928l6.432 2.658a3.387 3.387 0 011.912-.588c.063 0 .125.002.188.006l2.861-4.142V8.77c0-2.587 2.105-4.692 4.692-4.692 2.587 0 4.692 2.105 4.692 4.692 0 2.587-2.105 4.693-4.692 4.693h-.11l-4.076 2.911c0 .047.002.094.002.142 0 1.94-1.578 3.517-3.517 3.517-1.735 0-3.174-1.269-3.454-2.93L.533 14.568C1.905 19.848 6.49 23.754 12 23.754c6.627 0 12-5.373 12-12C24 5.373 18.627 0 12 0h-.021z"/>
            </svg>
            Login with Steam
          </a>

          <div className="mt-4 text-left bg-cad-card border border-cad-border rounded-lg p-3">
            <p className="text-xs font-semibold text-cad-ink mb-2">What we collect and why</p>
            <p className="text-xs text-cad-muted">
              When you sign in with Steam, CAD stores your Steam ID, display name, and avatar. This is used to create your account, keep your identity consistent in dispatch logs, and display your profile in-app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
