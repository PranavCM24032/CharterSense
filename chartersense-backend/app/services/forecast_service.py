from datetime import timedelta
from typing import Dict, Tuple

import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA

try:
    from prophet import Prophet
except Exception:  # pragma: no cover
    Prophet = None


class ForecastService:
    def __init__(self):
        self.models = {}
        self.scalers = {}

    def prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["day_of_week"] = df["date"].dt.dayofweek
        df["month"] = df["date"].dt.month
        df["quarter"] = df["date"].dt.quarter
        df["day_of_year"] = df["date"].dt.dayofyear

        df["rate_ma_7"] = df["rate"].rolling(window=7).mean()
        df["rate_ma_30"] = df["rate"].rolling(window=30).mean()
        df["rate_std_7"] = df["rate"].rolling(window=7).std()

        for lag in [1, 2, 3, 7, 14, 30]:
            df[f"lag_{lag}"] = df["rate"].shift(lag)

        df["momentum_7"] = df["rate"].pct_change(periods=7)
        df["momentum_30"] = df["rate"].pct_change(periods=30)

        return df.dropna().reset_index(drop=True)

    def forecast_with_prophet(self, df: pd.DataFrame, periods: int = 30):
        if Prophet is None:
            return None

        try:
            prophet_df = df[["date", "rate"]].rename(columns={"date": "ds", "rate": "y"})
            model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=False,
                changepoint_prior_scale=0.05,
            )
            model.fit(prophet_df)
            future = model.make_future_dataframe(periods=periods)
            forecast = model.predict(future)
            tail = forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].tail(periods)
            return tail
        except Exception:
            return None

    def forecast_with_arima(self, df: pd.DataFrame, periods: int = 30) -> Tuple[np.ndarray, np.ndarray]:
        series = df["rate"].astype(float)
        model = ARIMA(series, order=(5, 1, 2))
        fitted = model.fit()
        forecast = fitted.forecast(steps=periods)
        forecast_ci = fitted.get_forecast(steps=periods).conf_int()
        return np.asarray(forecast), np.asarray(forecast_ci)

    def forecast_with_ensemble(self, df: pd.DataFrame, periods: int = 30) -> Dict[str, np.ndarray]:
        prophet_forecast = self.forecast_with_prophet(df, periods)
        arima_forecast, arima_ci = self.forecast_with_arima(df, periods)

        if prophet_forecast is not None:
            ensemble = (prophet_forecast["yhat"].values + arima_forecast) / 2
            lower = np.minimum(prophet_forecast["yhat_lower"].values, arima_ci[:, 0])
            upper = np.maximum(prophet_forecast["yhat_upper"].values, arima_ci[:, 1])
        else:
            trend = np.linspace(float(df["rate"].iloc[-1]), float(df["rate"].iloc[-1]) * 1.08, periods)
            ensemble = arima_forecast if len(arima_forecast) == periods else trend
            lower = ensemble * 0.92
            upper = ensemble * 1.08

        return {"forecast": ensemble, "lower": lower, "upper": upper}

    def get_forecast(self, historical_df: pd.DataFrame, route: str, vessel_class: str, periods: int = 30):
        df = historical_df[
            (historical_df["route"] == route) & (historical_df["vessel_class"] == vessel_class)
        ].sort_values("date").copy()

        if len(df) < 30:
            return None

        forecast_result = self.forecast_with_ensemble(df, periods)
        last_date = df["date"].max()
        forecast_dates = [last_date + timedelta(days=i + 1) for i in range(periods)]

        return {
            "dates": forecast_dates,
            "values": forecast_result["forecast"].tolist(),
            "lower": forecast_result["lower"].tolist(),
            "upper": forecast_result["upper"].tolist(),
        }
