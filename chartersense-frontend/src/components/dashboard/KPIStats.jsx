import { AlertTriangle, Anchor, BarChart3, Clock, DollarSign, Ship } from 'lucide-react';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';

const kpis = {
  totalSavings: { value: 12.5, unit: '%', trend: 'up', change: 2.3 },
  forecastAccuracy: { value: 87, unit: '%', trend: 'up', change: 4.1 },
  vesselRecommendations: { value: 4, unit: '', trend: 'up', change: 1 },
  riskAlerts: { value: 2, unit: '', trend: 'down', change: 1 },
  activeTrades: { value: 6, unit: '', trend: 'stable', change: 0 },
  costPerTon: { value: 32.5, unit: '$', trend: 'down', change: 2.8 },
};

const config = [
  { key: 'totalSavings', icon: DollarSign, label: 'Potential Savings', colorClasses: { badge: 'bg-green-100 dark:bg-green-900/30', icon: 'text-green-600 dark:text-green-300' } },
  { key: 'forecastAccuracy', icon: BarChart3, label: 'Forecast Accuracy', colorClasses: { badge: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-600 dark:text-blue-300' } },
  { key: 'vesselRecommendations', icon: Ship, label: 'Vessel Recommendations', colorClasses: { badge: 'bg-purple-100 dark:bg-purple-900/30', icon: 'text-purple-600 dark:text-purple-300' } },
  { key: 'riskAlerts', icon: AlertTriangle, label: 'Risk Alerts', colorClasses: { badge: 'bg-red-100 dark:bg-red-900/30', icon: 'text-red-600 dark:text-red-300' } },
  { key: 'activeTrades', icon: Anchor, label: 'Active Trades', colorClasses: { badge: 'bg-orange-100 dark:bg-orange-900/30', icon: 'text-orange-600 dark:text-orange-300' } },
  { key: 'costPerTon', icon: DollarSign, label: 'Cost per Ton', colorClasses: { badge: 'bg-indigo-100 dark:bg-indigo-900/30', icon: 'text-indigo-600 dark:text-indigo-300' } },
];

export default function KPIStats() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {config.map((item, index) => {
        const data = kpis[Object.keys(kpis)[index]];
        const value = data.unit === '' ? Math.round(data.value) : data.value;

        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    <CountUp end={value} decimals={data.unit === '$' ? 2 : 0} suffix={data.unit} duration={1.5} />
                  </span>
                  {data.change > 0 && (
                    <span className="text-xs font-semibold text-green-600">+{data.change}%</span>
                  )}
                </div>
              </div>
              <div className={`rounded-lg p-2 ${item.colorClasses.badge}`}>
                <item.icon className={`h-4 w-4 ${item.colorClasses.icon}`} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
              <Clock className="h-3 w-3" />
              <span>Updated 2 min ago</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
