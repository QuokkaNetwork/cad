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
            href="/api/auth/cfx"
            className="inline-flex items-center gap-3 px-6 py-3 bg-[#f98c20] hover:bg-[#e57f1a] border border-[#f98c20] rounded-lg text-white font-medium transition-colors w-full justify-center"
          >
            Login with CFX
          </a>

          <p className="text-xs text-cad-muted mt-4">
            Sign in with your CFX account to access the CAD system
          </p>
        </div>
      </div>
    </div>
  );
}
