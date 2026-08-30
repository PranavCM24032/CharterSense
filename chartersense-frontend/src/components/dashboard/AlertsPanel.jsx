import { AlertCircle, AlertTriangle, BellRing } from 'lucide-react';

const alerts = [
  { type: 'danger', text: 'Port congestion at Paradip - 48hr delay expected', icon: AlertTriangle },
  { type: 'warning', text: 'Freight rates rising - lock in before March 15', icon: AlertCircle },
  { type: 'info', text: 'Vessel availability improved by 7% in South Africa corridor', icon: BellRing },
];

export default function AlertsPanel() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Alerts</h3>
        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-300">3 active</span>
      </div>
      <div className="space-y-3">
        {alerts.map((alert, index) => (
          <div key={index} className={`flex items-start gap-3 rounded-xl p-3 ${alert.type === 'danger' ? 'bg-red-50 dark:bg-red-900/20' : alert.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
            <alert.icon className={`mt-0.5 h-4 w-4 ${alert.type === 'danger' ? 'text-red-600' : alert.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'}`} />
            <p className="text-sm text-slate-700 dark:text-slate-200">{alert.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
