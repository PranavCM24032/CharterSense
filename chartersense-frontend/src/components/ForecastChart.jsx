import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function ForecastChart({ data }) {
  const chartData = {
    labels: data.forecast_dates.map((d) => new Date(d).toLocaleDateString()),
    datasets: [
      {
        label: 'Forecast Rate',
        data: data.forecast_values,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        fill: true,
        tension: 0.35,
      },
      {
        label: 'Upper Bound (80% CI)',
        data: data.upper_bound,
        borderColor: 'rgba(59, 130, 246, 0.4)',
        borderDash: [5, 5],
        fill: false,
        tension: 0.3,
      },
      {
        label: 'Lower Bound (80% CI)',
        data: data.lower_bound,
        borderColor: 'rgba(59, 130, 246, 0.4)',
        borderDash: [5, 5],
        fill: false,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: {
        display: true,
        text: `Freight Rate Forecast - ${data.route} (${data.vessel_class})`,
      },
      tooltip: {
        callbacks: {
          label: (context) => `$${context.parsed.y.toFixed(2)}/ton`,
        },
      },
    },
    scales: {
      y: { title: { display: true, text: 'Rate ($/ton)' } },
      x: { title: { display: true, text: 'Date' } },
    },
  };

  const lastValue = data.forecast_values[data.forecast_values.length - 1];
  const firstValue = data.forecast_values[0];
  const trendText = lastValue > firstValue ? 'rise' : 'fall';

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-800">Freight Rate Forecast</h2>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
          Confidence: {(data.confidence_score * 100).toFixed(0)}%
        </span>
      </div>
      <div className="h-80">
        <Line data={chartData} options={options} />
      </div>
      <div className="mt-4 text-sm text-slate-600">
        <p>
          <strong>Key Insight:</strong> Rates are expected to {trendText} over the forecast window.
        </p>
      </div>
    </div>
  );
}
