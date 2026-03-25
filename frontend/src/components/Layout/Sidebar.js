import { Link, useLocation } from "react-router-dom";

const NAV_SECTIONS = [
  // {
  //   title: "MAIN",
  //   items: [
  //     { path: "/", label: "Dashboard", icon: "🏠" },
  //   ],
  // },
  {
    title: "DATA QA",
    items: [
      { path: "/", label: "Upload File", icon: "⬆️" },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="w-64 h-screen flex-shrink-0 bg-[#3F4D67] text-white flex flex-col overflow-y-auto">

      {/* Logo / Branding */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center font-bold text-lg">
          Q
        </div>
        <div>
          <div className="font-bold text-sm tracking-wide">QA TOOL</div>
          <div className="text-[10px] text-white/50">DATA VALIDATION</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">

        {NAV_SECTIONS.map((section, idx) => (
          <div key={idx} className="mb-6">

            {/* Section Title */}
            <div className="text-[10px] text-white/40 px-3 mb-2 font-semibold tracking-widest uppercase">
              {section.title}
            </div>

            {/* Items */}
            <div className="space-y-1">
              {section.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
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
  );
}