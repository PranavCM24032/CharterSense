"""
================================================================================
  CharterSense — Intelligent Freight Rate Forecasting & Vessel Charter Optimization
  SIH Problem Statement ID : 26006
  Organization             : Ministry of Steel — SAIL (Steel Authority of India Limited)
  Stack                    : Pure Python (FastAPI + ML Engine) + HTML5 + CSS3 + JavaScript
================================================================================
"""

import os
import json
import logging
import random
from datetime import date, datetime, timedelta
from typing import Dict, Literal, Optional

import numpy as np
import pandas as pd
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from statsmodels.tsa.arima.model import ARIMA

# ==============================================================================
# 1. DATA MODELS & SCHEMAS
# ==============================================================================
ROUTES = [
    "Australia-East Coast India",
    "South Africa-East Coast India",
    "Indonesia-East Coast India",
    "Brazil-East Coast India",
]
VESSEL_CLASSES = ["Capesize", "Panamax", "Supramax"]
RouteName = Literal[
    "Australia-East Coast India", "South Africa-East Coast India",
    "Indonesia-East Coast India", "Brazil-East Coast India",
]
PortName = Literal["Vizag", "Paradip", "Haldia"]

logger = logging.getLogger(__name__)

class CharterRequest(BaseModel):
    route: RouteName = "Australia-East Coast India"
    cargo_size: float = Field(default=150000, gt=0, le=1_000_000)
    port: PortName = "Vizag"
    laycan_start: Optional[date] = None
    laycan_end: Optional[date] = None



# ==============================================================================
# 2. DATA GENERATOR (Synthetic Market & Port Engine)
# ==============================================================================
class DataGenerator:
    @staticmethod
    def generate_freight_data(days: int = 730) -> pd.DataFrame:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        dates = pd.date_range(start=start_date, end=end_date, freq="D")

        rng = random.Random(42)
        routes = ROUTES
        vessel_classes = VESSEL_CLASSES
        multiplier = {"Capesize": 1.25, "Panamax": 1.0, "Supramax": 0.82}
        # Mean-reverting (Ornstein-Uhlenbeck) process: freight rates hover in a
        # realistic band but move jaggedly every day, with a gentle seasonal pull.
        walk_cfg = {
            "Capesize": {"mean": 42.0, "theta": 0.16, "sigma": 1.1, "phase": 0.0},
            "Panamax": {"mean": 33.0, "theta": 0.16, "sigma": 0.95, "phase": 1.7},
            "Supramax": {"mean": 26.0, "theta": 0.16, "sigma": 0.85, "phase": 3.1},
        }

        records = []
        for route in routes:
            base_rate = rng.uniform(18, 42)
            for vessel in vessel_classes:
                cfg = walk_cfg[vessel]
                mean_level = cfg["mean"] * multiplier[vessel]
                rate = mean_level
                for idx, date in enumerate(dates):
                    # Gentle long-term seasonal pull (secondary to daily noise)
                    saisonal = cfg["sigma"] * 2.2 * np.sin(2 * np.pi * idx / 365 + cfg["phase"])
                    target = mean_level + saisonal
                    # Mean-reversion pulls back toward target; gauss adds daily jaggedness
                    rate = rate + cfg["theta"] * (target - rate) + rng.gauss(0, cfg["sigma"])
                    # Seasonal disruption blips (monsoon surges / dips)
                    if 140 < idx < 180:
                        rate += 2.5 * cfg["sigma"]
                    elif 330 < idx < 370:
                        rate -= 1.8 * cfg["sigma"]
                    rate = max(7.0, round(max(rate, 0.0), 2))

                    records.append({
                        "date": date,
                        "route": route,
                        "vessel_class": vessel,
                        "rate": rate,
                        "source": "synthetic",
                    })

        return pd.DataFrame(records)

    @staticmethod
    def generate_port_data() -> pd.DataFrame:
        ports = [
            {
                "port_name": "Vizag",
                "max_draft": 18.5,
                "berth_length": 340.0,
                "congestion_level": "Low",
                "average_turnaround": 36.0,
                "allowed_vessels": ["Capesize", "Panamax", "Supramax"],
            },
            {
                "port_name": "Paradip",
                "max_draft": 17.1,
                "berth_length": 300.0,
                "congestion_level": "Medium",
                "average_turnaround": 44.0,
                "allowed_vessels": ["Capesize", "Panamax", "Supramax"],
            },
            {
                "port_name": "Haldia",
                "max_draft": 12.5,
                "berth_length": 220.0,
                "congestion_level": "High",
                "average_turnaround": 58.0,
                "allowed_vessels": ["Panamax", "Supramax"], # Draft restriction excludes Capesize
            },
        ]
        return pd.DataFrame(ports)


# ==============================================================================
# 3. FORECASTING & OPTIMIZATION SERVICES
# ==============================================================================
class ForecastService:
    def forecast_with_arima(self, df: pd.DataFrame, periods: int = 30, vessel_class: str = ""):
        series = df["rate"].astype(float).values
        recent = float(np.mean(series[-30:])) if len(series) >= 30 else float(np.mean(series))

        # Gentle drift estimated from the most recent 30 observations
        window = series[-30:] if len(series) >= 30 else series
        if len(window) >= 2:
            x = np.arange(len(window))
            slope, intercept = np.polyfit(x, window, 1)
        else:
            slope, intercept = 0.0, float(window[-1])
        drift = float(slope)

        # Try ARIMA for a baseline; fall back to a bounded anchored drift if it diverges.
        try:
            model = ARIMA(series, order=(3, 1, 1))
            fitted = model.fit()
            base = np.asarray(fitted.forecast(steps=periods)).astype(float)
            conf_int = fitted.get_forecast(steps=periods).conf_int()
            lower = conf_int[:, 0] if hasattr(conf_int, 'shape') and conf_int.shape[1] > 0 else base * 0.93
            upper = conf_int[:, 1] if hasattr(conf_int, 'shape') and conf_int.shape[1] > 1 else base * 1.07
        except (ValueError, np.linalg.LinAlgError, FloatingPointError) as exc:
            logger.warning("ARIMA forecast failed; using drift fallback: %s", exc)
            base = recent + drift * np.arange(1, periods + 1)
            width = recent * 0.12
            lower = base - width
            upper = base + width

        # Clamp baseline into a realistic band around recent history so a volatile
        # series never produces absurd or negative projections.
        low_band = 0.55 * recent
        high_band = 1.6 * recent
        base = np.clip(base, low_band, high_band)
        lower = np.clip(np.asarray(lower).astype(float), low_band, high_band)
        upper = np.clip(np.asarray(upper).astype(float), low_band, high_band)

        # Overlay seeded, bounded market noise (ragged day-to-day movement).
        seasonal = self._seasonal_profile(df, periods, vessel_class)
        forecast = base + seasonal
        forecast = np.clip(forecast, low_band, high_band)

        width = np.maximum(np.asarray(upper) - np.asarray(lower), np.finfo(float).eps)
        lower = forecast - width * 0.5
        upper = forecast + width * 0.5
        lower = np.clip(lower, low_band, high_band)
        upper = np.clip(upper, low_band, high_band)
        return forecast, np.asarray(lower), np.asarray(upper)

    def _seasonal_profile(self, df: pd.DataFrame, periods: int, vessel_class: str = "") -> np.ndarray:
        """Project noisy, day-to-day market movement onto the forecast horizon.

        Real freight markets move unpredictably every day, so rather than a smooth
        sine we overlay a seeded mean-reverting random walk plus a mild seasonal
        drift. The seed keeps the path stable across refreshes/servers.
        """
        hist = df["rate"].astype(float).values
        level = float(np.mean(hist[-30:])) if len(hist) >= 30 else float(np.mean(hist)) if len(hist) else 1.0
        std = float(np.std(hist)) if len(hist) > 0 else 1.0
        amp = 0.35 * std if np.isfinite(std) else 0.1 * level

        seed = {"Capesize": 101, "Panamax": 202, "Supramax": 303}.get(vessel_class, 7)
        rng = random.Random(seed)
        phase = {"Capesize": 0.0, "Panamax": 1.9, "Supramax": 3.3}.get(vessel_class, 0.0)

        last_date = df["date"].max()
        seasonal_drift = np.zeros(periods)
        for i in range(periods):
            doy = (last_date + timedelta(days=i + 1)).timetuple().tm_yday
            seasonal_drift[i] = amp * 0.5 * np.sin(2 * np.pi * doy / 365 + phase)

        # Mean-reverting random walk = ragged, realistic day-to-day movement
        rw_state = 0.0
        rw = np.zeros(periods)
        for i in range(periods):
            rw_state = rw_state * 0.6 + rng.gauss(0, 1)
            rw[i] = rw_state
        rw = rw / (np.max(np.abs(rw)) + 1e-9)

        return seasonal_drift + amp * 1.1 * rw

    def get_forecast(self, historical_df: pd.DataFrame, route: str, vessel_class: str, periods: int = 30):
        df = historical_df[
            (historical_df["route"] == route) & (historical_df["vessel_class"] == vessel_class)
        ].sort_values("date").copy()

        if len(df) < 15:
            return None

        forecast_vals, lower_vals, upper_vals = self.forecast_with_arima(df, periods, vessel_class)
        last_date = df["date"].max()
        forecast_dates = [last_date + timedelta(days=i + 1) for i in range(periods)]

        return {
            "dates": forecast_dates,
            "values": [round(float(v), 2) for v in forecast_vals],
            "lower": [round(float(v), 2) for v in lower_vals],
            "upper": [round(float(v), 2) for v in upper_vals],
            "history_dates": df["date"].tail(45).dt.strftime("%Y-%m-%d").tolist(),
            "history_values": [round(float(v), 2) for v in df["rate"].tail(45)],
        }


class OptimizationService:
    def __init__(self):
        self.vessel_costs = {
            "Capesize": 85000,
            "Panamax": 45000,
            "Supramax": 35000,
        }
        self.vessel_capacities = {
            "Capesize": 180000,
            "Panamax": 75000,
            "Supramax": 55000,
        }

    def calculate_optimal_charter_window(self, forecast_data: Dict, start: date, end: date) -> Dict:
        dates = forecast_data["dates"]
        rates = forecast_data["values"]

        eligible = [(idx, rate) for idx, (forecast_date, rate) in enumerate(zip(dates, rates))
                    if start <= forecast_date.date() <= end]
        if not eligible:
            raise ValueError("Laycan window falls outside the available forecast horizon.")

        min_idx, min_rate = min(eligible, key=lambda item: item[1])
        min_date = dates[min_idx]
        min_rate = float(min_rate)
        current_rate = float(rates[0]) if len(rates) > 0 else 0.0

        saving_pct = ((current_rate - min_rate) / current_rate * 100) if current_rate else 0.0
        window_start = dates[max(0, min_idx - 5)]
        window_end = dates[min(len(dates) - 1, min_idx + 5)]

        return {
            "optimal_date": min_date.strftime("%Y-%m-%d") if isinstance(min_date, datetime) else str(min_date),
            "optimal_rate": min_rate,
            "current_rate": current_rate,
            "saving_percentage": round(saving_pct, 1),
            "charter_window_start": window_start.strftime("%Y-%m-%d") if isinstance(window_start, datetime) else str(window_start),
            "charter_window_end": window_end.strftime("%Y-%m-%d") if isinstance(window_end, datetime) else str(window_end),
            "wait_days": (min_date - dates[0]).days if min_idx > 0 and isinstance(min_date, datetime) else min_idx,
        }

    def recommend_vessel(self, cargo_size: float, route: str, port_info: Dict,
                         forecasts: Dict[str, Dict], start: date, end: date) -> Optional[Dict]:
        vessel_options = []
        allowed = port_info.get("allowed_vessels", ["Capesize", "Panamax", "Supramax"])

        for vessel_class, capacity in self.vessel_capacities.items():
            if vessel_class not in allowed:
                continue

            window = self.calculate_optimal_charter_window(forecasts[vessel_class], start, end)

            num_voyages = max(1, int(np.ceil(cargo_size / capacity)))
            total_capacity = num_voyages * capacity
            daily_cost = self.vessel_costs[vessel_class]
            voyage_days = self._estimate_voyage_days(route)
            operating_cost = daily_cost * voyage_days * num_voyages
            base_freight = cargo_size * window["optimal_rate"]
            congestion_days = max(0, (float(port_info["average_turnaround"]) - 36) / 24)
            demurrage_cost = congestion_days * 25000 * num_voyages
            total_cost = base_freight + operating_cost + demurrage_cost

            vessel_options.append({
                "vessel_class": vessel_class,
                "capacity": capacity,
                "total_capacity": total_capacity,
                "voyages_needed": num_voyages,
                "utilization": round((cargo_size / total_capacity) * 100, 1),
                "daily_cost": daily_cost,
                "voyage_days": voyage_days,
                "total_cost": round(total_cost, 2),
                "cost_per_ton": round(total_cost / cargo_size, 2),
                "base_freight": round(base_freight, 2),
                "operating_cost": round(operating_cost, 2),
                "demurrage_cost": round(demurrage_cost, 2),
                "charter_window": window,
            })

        if not vessel_options:
            return None

        vessel_options.sort(key=lambda x: x["cost_per_ton"])
        best = vessel_options[0]

        return {
            "recommended_vessel": best["vessel_class"],
            "capacity": best["capacity"],
            "voyages_needed": best["voyages_needed"],
            "utilization": f"{best['utilization']}%",
            "estimated_cost": best["total_cost"],
            "cost_per_ton": best["cost_per_ton"],
            "charter_window": best["charter_window"],
            "options": vessel_options,
            "alternatives": vessel_options[1:],
        }

    def _estimate_voyage_days(self, route: str) -> int:
        route_days = {
            "Australia-East Coast India": 20,
            "South Africa-East Coast India": 18,
            "Indonesia-East Coast India": 15,
            "Brazil-East Coast India": 35,
        }
        return route_days.get(route, 20)

    def assess_risk(self, forecast_data: Dict, port_data: Dict, current_date: datetime) -> Dict:
        risk_factors = []
        risk_score = 0

        congestion = port_data.get("congestion_level")
        if congestion == "High":
            risk_score += 25
            risk_factors.append("High destination port congestion")
        elif congestion == "Medium":
            risk_score += 15
            risk_factors.append("Moderate port turnaround delays")

        if current_date.month in [6, 7, 8, 9]:
            risk_score += 20
            risk_factors.append("Southwest Monsoon season — potential demurrage risk")

        return {
            "risk_score": min(100, risk_score),
            "risk_level": "Low" if risk_score < 30 else "Medium" if risk_score < 60 else "High",
            "risk_factors": risk_factors or ["Normal operational conditions"],
        }


# ==============================================================================
# 4. FASTAPI APP INITIALIZATION & ROUTES
# ==============================================================================
app = FastAPI(
    title="CharterSense AI Platform",
    description="Intelligent Freight Rate Forecasting & Vessel Charter Optimization for SAIL (PS 26006)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:8000").split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

data_gen = DataGenerator()
sample_data = data_gen.generate_freight_data()
port_data = data_gen.generate_port_data()
forecast_service = ForecastService()
opt_service = OptimizationService()
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(ROOT_DIR, "models")
MODEL_PATH = os.path.join(MODEL_DIR, "freight_rate_model.joblib")
MODEL_METRICS_PATH = os.path.join(MODEL_DIR, "freight_rate_metrics.json")


def load_trained_model_assets():
    if not (os.path.exists(MODEL_PATH) and os.path.exists(MODEL_METRICS_PATH)):
        return None, None
    try:
        with open(MODEL_METRICS_PATH, encoding="utf-8") as metrics_file:
            return joblib.load(MODEL_PATH), json.load(metrics_file)
    except (OSError, ValueError, EOFError) as exc:
        logger.warning("Trained freight model could not be loaded: %s", exc)
        return None, None


_, trained_model_metrics = load_trained_model_assets()


# Serve Root & Static Assets directly
@app.get("/", include_in_schema=False)
@app.get("/ui", include_in_schema=False)
async def serve_index():
    index_path = os.path.join(ROOT_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "CharterSense AI Platform Ready. Place index.html in the root folder."}

@app.get("/style.css", include_in_schema=False)
async def serve_css():
    css_path = os.path.join(ROOT_DIR, "style.css")
    if os.path.exists(css_path):
        return FileResponse(css_path, media_type="text/css")
    raise HTTPException(404, detail="style.css not found")

@app.get("/script.js", include_in_schema=False)
async def serve_js():
    js_path = os.path.join(ROOT_DIR, "script.js")
    if os.path.exists(js_path):
        return FileResponse(js_path, media_type="application/javascript")
    raise HTTPException(404, detail="script.js not found")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "CharterSense AI", "version": "1.0.0"}

@app.get("/api/dashboard/kpi")
async def get_kpis():
    return {
        "total_savings": None,
        "avg_forecast_accuracy": None,
        "note": "KPIs require live market and procurement data; synthetic demo data is not reported as operational performance.",
        "trained_disruption_model": trained_model_metrics if trained_model_metrics else None,
    }

@app.post("/api/charter/recommend")
async def get_recommendation(req: CharterRequest):
    if req.laycan_start and req.laycan_end and req.laycan_end <= req.laycan_start:
        raise HTTPException(422, detail="laycan_end must be after laycan_start.")

    matching = port_data[port_data["port_name"] == req.port]
    if matching.empty:
        raise HTTPException(404, detail=f"Port '{req.port}' not found.")
    port_info = matching.iloc[0].to_dict()

    forecast_start = (sample_data["date"].max() + timedelta(days=1)).date()
    laycan_start = req.laycan_start or forecast_start
    laycan_end = req.laycan_end or laycan_start + timedelta(days=30)
    if laycan_start < forecast_start:
        raise HTTPException(422, detail="laycan_start cannot be before the first forecast date.")
    if laycan_end > forecast_start + timedelta(days=89):
        raise HTTPException(422, detail="laycan_end must be within 90 days of the first forecast date.")

    forecasts = {}
    for vessel in port_info["allowed_vessels"]:
        result = forecast_service.get_forecast(sample_data, req.route, vessel, periods=90)
        if result:
            forecasts[vessel] = result
    if not forecasts:
        raise HTTPException(404, detail="Forecast data unavailable.")

    try:
        vessel_rec = opt_service.recommend_vessel(req.cargo_size, req.route, port_info, forecasts, laycan_start, laycan_end)
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc)) from exc
    if not vessel_rec:
        raise HTTPException(400, detail=f"No vessel class can berth at {req.port} due to draft restrictions.")

    risk = opt_service.assess_risk(forecasts[vessel_rec["recommended_vessel"]], port_info, datetime.now())
    congestion_mult = {"Low": 1.0, "Medium": 1.8, "High": 2.6}.get(port_info.get("congestion_level", "Low"), 1.0)
    monsoon_active = datetime.now().month in [6, 7, 8, 9]
    daily_demurrage = 25000

    plan = []
    for option in vessel_rec["options"]:
        forecast = forecasts[option["vessel_class"]]
        in_window = [
            (forecast_date, float(rate))
            for forecast_date, rate in zip(forecast["dates"], forecast["values"])
            if laycan_start <= forecast_date.date() <= laycan_end
        ]
        optimal_rate = min((r for _, r in in_window), default=0.0)
        for forecast_date, rate in in_window:
            base_freight = req.cargo_size * rate

            # Late-window penalty: cost premium for booking a date above the
            # cheapest rate available inside the laycan window.
            late_cost = max(0.0, (rate - optimal_rate) * req.cargo_size)

            # Demurrage allowance: congestion-scaled waiting cost. Days escalate
            # with market tightness (rate vs optimal) and monsoon congestion risk.
            market_scale = 0.8 + 0.4 * (rate / optimal_rate if optimal_rate else 1.0)
            wait_days = congestion_mult * market_scale * 0.6 * (1.4 if monsoon_active else 1.0)
            demurrage_cost = wait_days * daily_demurrage * option["voyages_needed"]

            plan.append({
                "date": forecast_date.strftime("%Y-%m-%d"),
                "vessel_class": option["vessel_class"],
                "capacity": option["capacity"],
                "rate": rate,
                "base_freight": round(base_freight, 2),
                "late_cost": round(late_cost, 2),
                "demurrage_cost": round(demurrage_cost, 2),
                "total_cost": round(base_freight + option["operating_cost"] + demurrage_cost + late_cost, 2),
            })
    plan.sort(key=lambda item: item["total_cost"])

    return {
        "route": req.route,
        "destination_port": req.port,
        "cargo_size": req.cargo_size,
        "requested_laycan": {"start": laycan_start.isoformat(), "end": laycan_end.isoformat()},
        "recommended_vessel": vessel_rec["recommended_vessel"],
        "voyages_needed": vessel_rec["voyages_needed"],
        "charter_window": vessel_rec["charter_window"],
        "estimated_cost": vessel_rec["estimated_cost"],
        "cost_per_ton": vessel_rec["cost_per_ton"],
        "risk_score": risk["risk_score"],
        "risk_level": risk["risk_level"],
        "risk_factors": risk["risk_factors"],
        "plan": plan,
        "options": vessel_rec["options"],
        "alternatives": vessel_rec.get("alternatives", []),
        "forecasts": {
            vessel: {
                "dates": [item.strftime("%Y-%m-%d") for item in result["dates"]],
                "values": result["values"],
                "lower": result["lower"],
                "upper": result["upper"],
                "history_dates": result["history_dates"],
                "history_values": result["history_values"],
            }
            for vessel, result in forecasts.items()
        },
    }


# ==============================================================================
# 5. CLI EXECUTION ENTRY POINT
# ==============================================================================
if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 70)
    print(" CharterSense AI Platform Starting (SIH PS 26006 - SAIL)")
    print(" Web Interface : http://localhost:8000")
    print(" Swagger Docs  : http://localhost:8000/docs")
    print("=" * 70 + "\n")
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
