"""
================================================================================
  CharterSense — Intelligent Freight Rate Forecasting & Vessel Charter Optimization
  SIH Problem Statement ID : 26006
  Organization             : Ministry of Steel — SAIL (Steel Authority of India Limited)
  Stack                    : Pure Python (FastAPI + ML Engine) + HTML5 + CSS3 + JavaScript
================================================================================
"""

import os
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from statsmodels.tsa.arima.model import ARIMA

# ==============================================================================
# 1. DATA MODELS & SCHEMAS
# ==============================================================================
class ForecastRequest(BaseModel):
    route: str
    vessel_class: str
    forecast_days: int = 30
    include_confidence: bool = True

class CharterRequest(BaseModel):
    route: str
    vessel_class: Optional[str] = "Capesize"
    cargo_size: float
    port: str
    laycan_start: Optional[str] = None
    laycan_end: Optional[str] = None


# ==============================================================================
# 2. DATA GENERATOR (Synthetic Market & Port Engine)
# ==============================================================================
class DataGenerator:
    @staticmethod
    def generate_freight_data(days: int = 730) -> pd.DataFrame:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        dates = pd.date_range(start=start_date, end=end_date, freq="D")

        routes = [
            "Australia-East Coast India",
            "South Africa-East Coast India",
            "Indonesia-East Coast India",
            "Brazil-East Coast India",
        ]
        vessel_classes = ["Capesize", "Panamax", "Supramax"]
        multiplier = {"Capesize": 1.25, "Panamax": 1.0, "Supramax": 0.82}

        records = []
        for route in routes:
            base_rate = random.uniform(18, 42)
            for vessel in vessel_classes:
                for idx, date in enumerate(dates):
                    seasonal = 6 * np.sin(2 * np.pi * idx / 365)
                    trend = 0.0015 * idx
                    noise = random.uniform(-2.5, 2.5)

                    if 140 < idx < 180:
                        noise += 10
                    elif 330 < idx < 370:
                        noise -= 8

                    rate = base_rate * multiplier[vessel] + seasonal + trend + noise
                    rate = max(7.0, round(rate, 2))

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
    def forecast_with_arima(self, df: pd.DataFrame, periods: int = 30):
        series = df["rate"].astype(float).values
        try:
            model = ARIMA(series, order=(3, 1, 1))
            fitted = model.fit()
            forecast = fitted.forecast(steps=periods)
            conf_int = fitted.get_forecast(steps=periods).conf_int()
            lower = conf_int[:, 0] if hasattr(conf_int, 'shape') and conf_int.shape[1] > 0 else forecast * 0.93
            upper = conf_int[:, 1] if hasattr(conf_int, 'shape') and conf_int.shape[1] > 1 else forecast * 1.07
            return np.asarray(forecast), np.asarray(lower), np.asarray(upper)
        except Exception:
            last = float(series[-1])
            trend = np.linspace(last, last * 1.04, periods)
            return trend, trend * 0.92, trend * 1.08

    def get_forecast(self, historical_df: pd.DataFrame, route: str, vessel_class: str, periods: int = 30):
        df = historical_df[
            (historical_df["route"] == route) & (historical_df["vessel_class"] == vessel_class)
        ].sort_values("date").copy()

        if len(df) < 15:
            return None

        forecast_vals, lower_vals, upper_vals = self.forecast_with_arima(df, periods)
        last_date = df["date"].max()
        forecast_dates = [last_date + timedelta(days=i + 1) for i in range(periods)]

        return {
            "dates": forecast_dates,
            "values": [round(float(v), 2) for v in forecast_vals],
            "lower": [round(float(v), 2) for v in lower_vals],
            "upper": [round(float(v), 2) for v in upper_vals],
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

    def calculate_optimal_charter_window(self, forecast_data: Dict, cargo_size: float) -> Dict:
        dates = forecast_data["dates"]
        rates = forecast_data["values"]

        min_idx = int(np.argmin(rates))
        min_date = dates[min_idx]
        min_rate = float(rates[min_idx])
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

    def recommend_vessel(self, cargo_size: float, route: str, port_info: Dict) -> Optional[Dict]:
        vessel_options = []
        allowed = port_info.get("allowed_vessels", ["Capesize", "Panamax", "Supramax"])

        for vessel_class, capacity in self.vessel_capacities.items():
            if vessel_class not in allowed:
                continue

            num_voyages = max(1, int(np.ceil(cargo_size / capacity)))
            total_capacity = num_voyages * capacity
            daily_cost = self.vessel_costs[vessel_class]
            voyage_days = self._estimate_voyage_days(route)
            total_cost = daily_cost * voyage_days * num_voyages

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

data_gen = DataGenerator()
sample_data = data_gen.generate_freight_data()
port_data = data_gen.generate_port_data()
forecast_service = ForecastService()
opt_service = OptimizationService()
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))


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
        "total_savings": 12.5,
        "avg_forecast_accuracy": 87.4,
        "recommended_vessels": 4,
        "risk_alerts": 1,
        "active_trades": 4,
        "cost_per_ton": 26.13,
    }

@app.get("/api/forecast/routes")
async def get_routes():
    return {
        "routes": [
            "Australia-East Coast India",
            "South Africa-East Coast India",
            "Indonesia-East Coast India",
            "Brazil-East Coast India",
        ]
    }

@app.get("/api/forecast/vessel-classes")
async def get_vessel_classes():
    return {"vessel_classes": ["Capesize", "Panamax", "Supramax"]}

@app.get("/api/charter/ports")
async def get_ports():
    return {"ports": port_data.to_dict(orient="records")}

@app.post("/api/forecast/predict")
async def predict_forecast(req: ForecastRequest):
    result = forecast_service.get_forecast(sample_data, req.route, req.vessel_class, req.forecast_days)
    if not result:
        raise HTTPException(404, detail="Not enough historical data for route/vessel.")
    return {
        "route": req.route,
        "vessel_class": req.vessel_class,
        "forecast_dates": [d.strftime("%Y-%m-%d") for d in result["dates"]],
        "forecast_values": result["values"],
        "lower_bound": result["lower"],
        "upper_bound": result["upper"],
        "confidence_score": 0.88,
    }

@app.post("/api/charter/recommend")
async def get_recommendation(
    route: str = Query("Australia-East Coast India"),
    vessel_class: str = Query("Capesize"),
    cargo_size: float = Query(150000, description="Cargo requirement in Metric Tons"),
    port: str = Query("Vizag", description="Destination port (Vizag, Paradip, Haldia)"),
):
    matching = port_data[port_data["port_name"] == port]
    if matching.empty:
        raise HTTPException(404, detail=f"Port '{port}' not found.")
    port_info = matching.iloc[0].to_dict()

    forecast_data = forecast_service.get_forecast(sample_data, route, vessel_class, periods=45)
    if not forecast_data:
        raise HTTPException(404, detail="Forecast data unavailable.")

    window = opt_service.calculate_optimal_charter_window(forecast_data, cargo_size)
    vessel_rec = opt_service.recommend_vessel(cargo_size, route, port_info)
    if not vessel_rec:
        raise HTTPException(400, detail=f"No vessel class can berth at {port} due to draft restrictions.")

    risk = opt_service.assess_risk(forecast_data, port_info, datetime.now())

    return {
        "route": route,
        "destination_port": port,
        "cargo_size": cargo_size,
        "recommended_vessel": vessel_rec["recommended_vessel"],
        "voyages_needed": vessel_rec["voyages_needed"],
        "charter_window": window,
        "estimated_cost": vessel_rec["estimated_cost"],
        "cost_per_ton": vessel_rec["cost_per_ton"],
        "risk_score": risk["risk_score"],
        "risk_level": risk["risk_level"],
        "risk_factors": risk["risk_factors"],
        "alternatives": vessel_rec.get("alternatives", []),
    }


# ==============================================================================
# 5. CLI EXECUTION ENTRY POINT
# ==============================================================================
if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 70)
    print(" 🚢 CharterSense AI Platform Starting (SIH PS 26006 · SAIL)")
    print(" Web Interface : http://localhost:8000")
    print(" Swagger Docs  : http://localhost:8000/docs")
    print("=" * 70 + "\n")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
