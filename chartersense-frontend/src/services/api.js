import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const forecastService = {
  getForecast: (route, vesselClass, days = 30) =>
    api.post('/forecast/predict', {
      route,
      vessel_class: vesselClass,
      forecast_days: days,
    }),
  getRoutes: () => api.get('/forecast/routes'),
  getVesselClasses: () => api.get('/forecast/vessel-classes'),
};

export const charterService = {
  getRecommendation: (route, vesselClass, cargoSize, port) =>
    api.post(`/charter/recommend?route=${encodeURIComponent(route)}&vessel_class=${encodeURIComponent(vesselClass)}&cargo_size=${cargoSize}&port=${encodeURIComponent(port)}`),
  getPorts: () => api.get('/charter/ports'),
};

export const dashboardService = {
  getKPI: () => api.get('/dashboard/kpi'),
};
