/* Summary Stat Card */
export default function SummaryCard({ label, value, sub, colorCls, bgGradient, borderColor, icon, passRate }) {
  return (
    <div className="card card-hover p-5 relative overflow-hidden" style={{ borderColor }}>
      <div className="flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: bgGradient, color: '#fff' }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-2xl font-black ${colorCls} leading-none`}>{value}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">{label}</div>
          {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
        </div>
        {passRate !== undefined && (
          <PassRateRing rate={passRate} />
        )}
      </div>
    </div>
  );
}