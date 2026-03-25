 /* Per-Column Summary — groups multiple rules for the same column into one row */
export default function  ColumnSummaryTable({ summary }) {
  if (!summary || !Array.isArray(summary) || summary.length === 0) return null;

  // Group by column name, preserving order of first appearance
  const grouped = [];
  const indexMap = {};
  summary.forEach((item) => {
    const col = item.column || item.col || '—';
    const pass = item.passCount ?? item.pass_count ?? item.passed ?? 0;
    const fail = item.failCount ?? item.fail_count ?? item.failed ?? 0;
    const rule = item.rule || item.rule_type || 'validation';
    if (indexMap[col] === undefined) {
      indexMap[col] = grouped.length;
      grouped.push({ col, rules: [{ rule, pass, fail }] });
    } else {
      grouped[indexMap[col]].rules.push({ rule, pass, fail });
    }
  });

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-100 flex items-center gap-2">
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-blue-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        <h3 className="text-sm font-bold text-slate-700">Validation Rules Summary</h3>
        <span className="ml-auto badge-info">{summary.length} rule{summary.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-100">
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-40">Column</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Rule</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Passes</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Fails</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[160px]">Pass Rate</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((group, gIdx) => {
              const totalPass = group.rules.reduce((s, r) => s + r.pass, 0);
              const totalFail = group.rules.reduce((s, r) => s + r.fail, 0);
              const total = totalPass + totalFail;
              const passRate = total > 0 ? Math.round((totalPass / total) * 100) : 100;
              return (
                <tr key={gIdx} className="border-b border-slate-100 hover:bg-blue-50/20 transition-colors">
                  <td className="px-5 py-3 font-semibold text-xs text-slate-700 align-middle">
                    <span className="border-l-2 border-blue-400 pl-2">{group.col}</span>
                  </td>
                  <td className="px-5 py-3 align-middle">
                    <div className="flex flex-wrap gap-1.5">
                      {group.rules.map((r, i) => (
                        <span key={i} className={`badge-info text-[11px] ${r.fail > 0 ? 'bg-red-50 border-red-200 text-red-700' : ''}`}>
                          {r.rule}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-bold text-emerald-600 text-sm align-middle">{totalPass.toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm align-middle">
                    <span className={totalFail > 0 ? 'font-bold text-red-600' : 'text-slate-400'}>{totalFail.toLocaleString()}</span>
                  </td>
                  <td className="px-5 py-3 min-w-[160px] align-middle">
                    <RateBar value={passRate} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}