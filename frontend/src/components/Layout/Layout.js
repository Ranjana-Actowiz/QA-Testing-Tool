import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden">

      <Sidebar />

      <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">

        {/* Top header — shows hamburger on mobile */}
        <header className="flex items-center px-4 sm:px-6 py-3 sm:py-4 bg-white flex-shrink-0 min-h-[52px]">
          <button
            onClick={() => window.dispatchEvent(new Event("toggleMobileSidebar"))}
            className="lg:hidden mr-3 w-8 h-8 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors bg-transparent border-none cursor-pointer flex-shrink-0"
            aria-label="Open menu"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1" />
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>

      </div>

    </div>
  );
}
