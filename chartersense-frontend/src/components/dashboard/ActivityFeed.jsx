const activity = [
  { title: 'Capesize route revised', subtitle: 'Australia → Paradip', time: '2 min ago' },
  { title: 'Fleet utilization updated', subtitle: 'Vessel mix optimized', time: '15 min ago' },
  { title: 'Risk model re-scored', subtitle: 'South Africa corridor', time: '42 min ago' },
];

export default function ActivityFeed() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Activity Feed</h3>
      <div className="space-y-4">
        {activity.map((item, index) => (
          <div key={index} className="flex gap-3 border-b border-slate-200 pb-3 last:border-b-0 dark:border-slate-700">
            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
            </div>
            <span className="text-[10px] text-slate-400">{item.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
