import { AlertCircle, Anchor, BarChart3, DollarSign, Ship } from 'lucide-react';

export default function Dashboard() {
  const kpi = {
    total_savings: 12.5,
    avg_forecast_accuracy: 87,
    recommended_vessels: 4,
    risk_alerts: 2,
    active_trades: 6,
    cost_per_ton: 32.5,
  };

  const KPICard = ({ icon: Icon, title, value, unit = '', color = 'blue' }) => (
    <div className={`rounded-2xl bg-white p-4 shadow-md ring-1 ring-slate-100 border-l-4 border-${color}-500`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {value}
            {unit}
          </p>
        </div>
        <Icon className={`h-8 w-8 text-${color}-500 opacity-80`} />
      </div>
    </div>
  );

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-xl font-bold text-slate-800">Dashboard - Key Metrics</h2>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KPICard icon={DollarSign} title="Potential Savings" value={kpi.total_savings} unit="%" color="green" />
        <KPICard icon={BarChart3} title="Forecast Accuracy" value={kpi.avg_forecast_accuracy} unit="%" color="blue" />
        <KPICard icon={Ship} title="Vessel Rec." value={kpi.recommended_vessels} color="purple" />
        <KPICard icon={AlertCircle} title="Risk Alerts" value={kpi.risk_alerts} color="red" />
        <KPICard icon={Anchor} title="Active Trades" value={kpi.active_trades} color="orange" />
        <KPICard icon={DollarSign} title="Cost per Ton" value={kpi.cost_per_ton} unit="$" color="indigo" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-md">
          <h3 className="mb-3 font-semibold text-slate-700">Recent Charter Activity</h3>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between border-b border-slate-200 pb-2 last:border-b-0">
                <div>
                  <p className="text-sm font-medium text-slate-700">Capesize - Australia to Paradip</p>
                  <p className="text-xs text-slate-500">Feb {i + 5}, 2026</p>
                </div>
                <span className="text-sm font-semibold text-green-600">$28.50/ton</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-md">
          <h3 className="mb-3 font-semibold text-slate-700">Active Alerts</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span>Port congestion at Paradip - 48hr delay expected</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-2 text-sm text-yellow-700">
              <AlertCircle className="h-4 w-4" />
              <span>Freight rates rising - lock in before March 15</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
