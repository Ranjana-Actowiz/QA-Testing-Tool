export function Loader() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
            <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" style={{ animationDuration: '1.5s' }}></div>
          </div>
          <p className="text-slate-600 font-medium">Loading validation report...</p>
        </div>
      </div>
    )
}