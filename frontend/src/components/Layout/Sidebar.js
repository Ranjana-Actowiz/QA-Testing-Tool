import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { HiOutlineUpload } from "react-icons/hi";

const NAV_SECTIONS = [
  {
    items: [
      { path: "/", label: "Upload File", icon: <HiOutlineUpload /> },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const [mode, setMode] = useState("open");
  const [hovered, setHovered] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const expanded = mode !== "collapsed" || hovered;

  // Listen for mobile toggle/close events dispatched by Layout
  useEffect(() => {
    const handleToggle = () => setIsMobileOpen((p) => !p);
    const handleClose = () => setIsMobileOpen(false);
    window.addEventListener("toggleMobileSidebar", handleToggle);
    window.addEventListener("closeMobileSidebar", handleClose);
    return () => {
      window.removeEventListener("toggleMobileSidebar", handleToggle);
      window.removeEventListener("closeMobileSidebar", handleClose);
    };
  }, []);


  // Auto-close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);


  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const navItemCls = (active) =>
    `flex items-center py-3 rounded-lg text-base transition-all ${expanded ? "gap-3 px-4" : "justify-center px-2"} ${active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
    }`;


  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        onMouseEnter={() => mode === "collapsed" && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`flex flex-col bg-[#3F4D67] text-white h-full transition-all duration-300 ease-in-out fixed lg:relative z-50 lg:z-auto ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${expanded ? "w-64" : "w-16"} overflow-y-auto overflow-x-hidden`}
      >
        {/* Logo / Branding */}
        <div className={`border-b border-white/10 flex items-center py-4 flex-shrink-0 ${expanded ? "px-5 gap-3" : "justify-center px-2"}`}>
          {expanded ? (
            <>
              <Link to="/" className="flex items-center gap-2.5 min-w-0 flex-1" onClick={() => setIsMobileOpen(false)}>
                <div className="rounded-full overflow-hidden bg-white shrink-0">
                  <img src="/icon.svg" alt="App logo" className="h-10 w-10 shrink-0 scale-110" />
                </div>
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="text-lg font-extrabold text-white tracking-widest uppercase">Actowiz</span>
                  <span className="text-xs font-semibold tracking-widest uppercase text-white text-center">QA TOOL</span>
                </div>
              </Link>

              {/* Desktop collapse/expand button */}
              <button
                onClick={() => {
                  setMode(mode === "collapsed" ? "open" : "collapsed");
                  setHovered(false);
                }}
                className="hidden lg:flex shrink-0 ml-auto h-9 w-9 items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition bg-transparent border-none cursor-pointer"
                aria-label={mode === "collapsed" ? "Pin sidebar open" : "Collapse sidebar"}
              >
                {mode === "open" ? (
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>

              {/* Mobile close button */}
              <button
                onClick={() => setIsMobileOpen(false)}
                className="lg:hidden shrink-0 ml-1 h-9 w-9 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition bg-transparent border-none cursor-pointer"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </>
          ) : (
            <div className="w-8 h-8 bg-white rounded-xl overflow-hidden flex items-center justify-center">
              <img src="/icon.svg" alt="QA Tool" className="w-8 h-8 object-contain" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className={`flex-1 overflow-y-auto py-4 ${expanded ? "px-2" : "px-2"}`}>
          {NAV_SECTIONS.map((section, idx) => (
            <div key={idx} className="mb-4">
              {expanded && section.title && (
                <div className="text-[10px] text-white/40 px-3 mb-2 font-semibold tracking-widest uppercase">
                  {section.title}
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileOpen(false)}
                    title={!expanded ? item.label : undefined}
                    className={navItemCls(isActive(item.path))}
                  >
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    {expanded && <span className="font-semibold text-sm">{item.label}</span>}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
