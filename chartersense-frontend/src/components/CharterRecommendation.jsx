import { AlertTriangle, Ship } from 'lucide-react';

export default function CharterRecommendation({ data }) {
  const getRiskColor = (level) => {
    switch (level) {
      case 'Low':
        return 'bg-green-100 text-green-700';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'High':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-md">
      <div className="bg-gradient-to-r from-green-600 to-green-700 p-4 text-white">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Ship size={22} />
          Charter Recommendation
        </h2>
      </div>

      <div className="space-y-6 p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="mb-2 text-lg font-semibold text-slate-800">Recommended Vessel</h3>
            <div className="text-2xl font-bold text-blue-700">{data.recommended_vessel}</div>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <p>Capacity: {data.capacity?.toLocaleString() || 'N/A'} DWT</p>
              <p>Utilization: {data.utilization || 'N/A'}</p>
              <p>Cost per ton: ${Number(data.cost_per_ton || 0).toFixed(2)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="mb-2 text-lg font-semibold text-slate-800">Charter Cost</h3>
            <div className="text-2xl font-bold text-green-700">${(Number(data.estimated_cost || 0) / 1000).toFixed(1)}K</div>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <p>Optimal Date: {new Date(data.charter_window?.optimal_date).toLocaleDateString()}</p>
              <p>
                Window: {new Date(data.charter_window?.start).toLocaleDateString()} - {new Date(data.charter_window?.end).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-lg font-semibold text-slate-800">Risk Assessment</h3>
          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium ${getRiskColor(data.risk_level)}`}>
            <AlertTriangle size={16} />
            <span>{data.risk_level} Risk</span>
            <span className="text-sm">Score: {data.risk_score}/100</span>
          </div>

          {data.risk_factors && data.risk_factors.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-slate-700">Risk Factors:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
                {data.risk_factors.map((factor, index) => (
                  <li key={index}>{factor}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-xl border-l-4 border-blue-500 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-800">Recommendation Reason</p>
          <p className="mt-2 text-sm text-blue-700">{data.recommendation_reason}</p>
        </div>

        {data.alternatives && data.alternatives.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Alternative Vessel Options</h4>
            <div className="grid gap-2 md:grid-cols-2">
              {data.alternatives.map((alt, index) => (
                <div key={index} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <span className="font-semibold">{alt.vessel_class}</span>
                  <span className="ml-2 text-slate-500">${Number(alt.cost_per_ton || 0).toFixed(2)}/ton</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
