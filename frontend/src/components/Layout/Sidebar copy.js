import { Link, useLocation } from "react-router-dom";

const NAV_SECTIONS = [
  {
    // title: "DATA QA",
    items: [
      { path: "/", label: "Upload File", icon: "⬆️" },
    ],
  },
];

export default function Sidebar({ open, onClose }) {
  const location = useLocation();

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 flex flex-col bg-[#3F4D67] text-white overflow-y-auto
          transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 md:flex md:flex-shrink-0
        `}
      >
        {/* Logo / Branding */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center">
            <img src="/icon.svg" alt="QA Tool" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide">QA TOOL</div>
            <div className="text-[10px] text-white/50">DATA VALIDATION</div>
          </div>
          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="ml-auto md:hidden w-7 h-7 flex items-center justify-center text-white/60 hover:text-white bg-transparent border-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section, idx) => (
            <div key={idx} className="mb-6">
              <div className="text-[10px] text-white/40 px-3 mb-2 font-semibold tracking-widest uppercase">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
                      isActive(item.path)
                        ? "bg-white/10 border-l-4 border-cyan-400 text-white"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
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
