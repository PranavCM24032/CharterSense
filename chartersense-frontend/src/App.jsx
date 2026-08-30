import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import CharterRecommendation from './components/CharterRecommendation';
import ForecastChart from './components/ForecastChart';
import ActivityFeed from './components/dashboard/ActivityFeed';
import AlertsPanel from './components/dashboard/AlertsPanel';
import KPIStats from './components/dashboard/KPIStats';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './components/Dashboard';
import { charterService, forecastService } from './services/api';

function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Operations Overview</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Steel logistics intelligence</h2>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
          +14.2% vs last month
        </div>
      </div>

      <KPIStats />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <Dashboard />
        <AlertsPanel />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Route Performance</h3>
          <div className="h-64 rounded-xl bg-gradient-to-br from-blue-50 to-slate-100 p-4 dark:from-slate-800 dark:to-slate-900">
            <div className="flex h-full items-end justify-between gap-3 px-2 pb-2">
              {[42, 58, 60, 72, 84, 90, 76].map((bar, index) => (
                <div key={index} className="flex w-full flex-col items-center gap-2">
                  <div className="w-full rounded-t-xl bg-gradient-to-t from-blue-600 to-blue-400" style={{ height: `${bar}%` }} />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">W{index + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <ActivityFeed />
      </div>
    </div>
  );
}

function ForecastPage({ routes, vesselClasses, ports, selectedRoute, selectedVessel, selectedPort, cargoSize, setSelectedRoute, setSelectedVessel, setSelectedPort, setCargoSize, forecastData, handleForecast, loading }) {
  return (
    <div className="space-y-6">
      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow-md dark:bg-slate-800">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Route</label>
          <select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
            {routes.map((route) => <option key={route} value={route}>{route}</option>)}
          </select>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-md dark:bg-slate-800">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Vessel Class</label>
          <select value={selectedVessel} onChange={(e) => setSelectedVessel(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
            {vesselClasses.map((vessel) => <option key={vessel} value={vessel}>{vessel}</option>)}
          </select>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-md dark:bg-slate-800">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Port</label>
          <select value={selectedPort} onChange={(e) => setSelectedPort(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
            {ports.map((port) => <option key={port} value={port}>{port}</option>)}
          </select>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-md dark:bg-slate-800">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Cargo Size (MT)</label>
          <input type="number" min="10000" step="5000" value={cargoSize} onChange={(e) => setCargoSize(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
        </div>
      </div>

      <button onClick={handleForecast} disabled={loading} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70">
        {loading ? 'Loading...' : 'Generate Forecast'}
      </button>

      {forecastData && <ForecastChart data={forecastData} />}
    </div>
  );
}

function CharterPage({ routes, vesselClasses, ports, selectedRoute, selectedVessel, selectedPort, cargoSize, setSelectedRoute, setSelectedVessel, setSelectedPort, setCargoSize, recommendation, handleRecommendation, loading }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow-md dark:bg-slate-800">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Route</label>
          <select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
            {routes.map((route) => <option key={route} value={route}>{route}</option>)}
          </select>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-md dark:bg-slate-800">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Vessel Class</label>
          <select value={selectedVessel} onChange={(e) => setSelectedVessel(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
            {vesselClasses.map((vessel) => <option key={vessel} value={vessel}>{vessel}</option>)}
          </select>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-md dark:bg-slate-800">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Port</label>
          <select value={selectedPort} onChange={(e) => setSelectedPort(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
            {ports.map((port) => <option key={port} value={port}>{port}</option>)}
          </select>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-md dark:bg-slate-800">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Cargo Size (MT)</label>
          <input type="number" min="10000" step="5000" value={cargoSize} onChange={(e) => setCargoSize(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
        </div>
      </div>

      <button onClick={handleRecommendation} disabled={loading} className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70">
        {loading ? 'Loading...' : 'Get Charter Recommendation'}
      </button>

      {recommendation && <CharterRecommendation data={recommendation} />}
    </div>
  );
}

function PlaceholderPage({ title, description }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Module</p>
      <h2 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-2 max-w-xl text-slate-600 dark:text-slate-300">{description}</p>
    </div>
  );
}

export default function App() {
  const [routes, setRoutes] = useState([]);
  const [vesselClasses, setVesselClasses] = useState([]);
  const [ports, setPorts] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedVessel, setSelectedVessel] = useState('');
  const [selectedPort, setSelectedPort] = useState('');
  const [cargoSize, setCargoSize] = useState(50000);
  const [forecastData, setForecastData] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [routesRes, vesselRes, portsRes] = await Promise.all([
        forecastService.getRoutes(),
        forecastService.getVesselClasses(),
        charterService.getPorts(),
      ]);

      setRoutes(routesRes.data.routes || []);
      setVesselClasses(vesselRes.data.vessel_classes || []);
      setPorts(portsRes.data.ports || []);

      if ((routesRes.data.routes || []).length > 0) setSelectedRoute(routesRes.data.routes[0]);
      if ((vesselRes.data.vessel_classes || []).length > 0) setSelectedVessel(vesselRes.data.vessel_classes[0]);
      if ((portsRes.data.ports || []).length > 0) setSelectedPort(portsRes.data.ports[0]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const handleForecast = async () => {
    setLoading(true);
    try {
      const response = await forecastService.getForecast(selectedRoute, selectedVessel, 30);
      setForecastData(response.data);
    } catch (error) {
      console.error('Forecast error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendation = async () => {
    setLoading(true);
    try {
      const response = await charterService.getRecommendation(
        selectedRoute,
        selectedVessel,
        cargoSize,
        selectedPort,
      );
      setRecommendation(response.data);
    } catch (error) {
      console.error('Recommendation error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <Header onMenuClick={() => setSidebarOpen((value) => !value)} />
      <Sidebar isOpen={sidebarOpen} />

      <main className={`pt-6 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'} pr-6`}>
        <div className="mx-auto max-w-7xl">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/forecast" element={<ForecastPage routes={routes} vesselClasses={vesselClasses} ports={ports} selectedRoute={selectedRoute} selectedVessel={selectedVessel} selectedPort={selectedPort} cargoSize={cargoSize} setSelectedRoute={setSelectedRoute} setSelectedVessel={setSelectedVessel} setSelectedPort={setSelectedPort} setCargoSize={setCargoSize} forecastData={forecastData} handleForecast={handleForecast} loading={loading} />} />
            <Route path="/charter" element={<CharterPage routes={routes} vesselClasses={vesselClasses} ports={ports} selectedRoute={selectedRoute} selectedVessel={selectedVessel} selectedPort={selectedPort} cargoSize={cargoSize} setSelectedRoute={setSelectedRoute} setSelectedVessel={setSelectedVessel} setSelectedPort={setSelectedPort} setCargoSize={setCargoSize} recommendation={recommendation} handleRecommendation={handleRecommendation} loading={loading} />} />
            <Route path="/scenarios" element={<PlaceholderPage title="Scenario Analysis" description="Run and compare multiple planning scenarios for freight exposure, risk routing, and vessel charter timing across corridors." />} />
            <Route path="/reports" element={<PlaceholderPage title="Reports" description="Generate exportable analytics, executive summaries, and route-level assessment pack reports for SAIL stakeholders." />} />
            <Route path="/settings" element={<PlaceholderPage title="Settings" description="Configure forecasting thresholds, charter policies, calculation baselines, and user-access permissions for operations teams." />} />
            <Route path="/help" element={<PlaceholderPage title="Help Center" description="Access operational guidance, model assumptions, support contacts, and onboarding flows for the CharterSense platform." />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
