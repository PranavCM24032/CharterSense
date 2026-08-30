import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { charterService, forecastService } from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [forecastData, setForecastData] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('Just now');

  const fetchForecast = useCallback(async (params) => {
    setLoading(true);
    try {
      const response = await forecastService.getForecast(params.route, params.vesselClass, params.days ?? 30);
      setForecastData(response.data);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (error) {
      console.error('Forecast fetch failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecommendation = useCallback(async (params) => {
    setLoading(true);
    try {
      const response = await charterService.getRecommendation(
        params.route,
        params.vesselClass,
        params.cargoSize,
        params.port,
      );
      setRecommendation(response.data);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (error) {
      console.error('Recommendation fetch failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(() => ({
    loading,
    forecastData,
    recommendation,
    lastUpdated,
    fetchForecast,
    fetchRecommendation,
    setLastUpdated,
  }), [loading, forecastData, recommendation, lastUpdated, fetchForecast, fetchRecommendation]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
