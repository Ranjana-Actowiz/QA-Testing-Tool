import Sidebar from "./Sidebar";
import { useLocation } from "react-router-dom";

function getPageTitle(pathname) {
  if (pathname.startsWith('/results/')) return 'Validation Results';
  return 'Upload File';
}

export default function Layout({ children }) {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden">

      <Sidebar />

      <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">

        {/* Top header */}
        <header className="flex items-center justify-between px-6 py-5 bg-white border-b border-slate-100 flex-shrink-0">
          {/* <h1 className="text-lg font-bold text-slate-800">{pageTitle}</h1> */}
          {/* <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              SA
            </div>
            <span className="text-sm font-semibold text-slate-700">Super Admin</span>
            <div className="w-4 h-4 border-2 border-slate-300 rounded-sm flex-shrink-0" />
          </div> */}
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>

      </div>

    </div>
  );
}