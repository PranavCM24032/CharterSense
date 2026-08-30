import numpy as np
from datetime import datetime
from typing import Dict


class OptimizationService:
    def __init__(self):
        self.vessel_costs = {
            "Capesize": 85000,
            "Panamax": 45000,
            "Supramax": 35000,
        }

        self.vessel_capacities = {
            "Capesize": 180000,
            "Panamax": 85000,
            "Supramax": 60000,
        }

    def calculate_optimal_charter_window(self, forecast_data: Dict, cargo_size: float, max_wait_days: int = 60) -> Dict:
        dates = forecast_data["dates"]
        rates = forecast_data["values"]

        min_idx = int(np.argmin(rates))
        min_date = dates[min_idx]
        min_rate = float(rates[min_idx])
        current_rate = float(rates[0]) if len(rates) > 0 else 0.0

        saving_pct = ((current_rate - min_rate) / current_rate * 100) if current_rate else 0.0
        window_start = dates[max(0, min_idx - 7)]
        window_end = dates[min(len(dates) - 1, min_idx + 7)]

        return {
            "optimal_date": min_date,
            "optimal_rate": min_rate,
            "current_rate": current_rate,
            "saving_percentage": saving_pct,
            "charter_window_start": window_start,
            "charter_window_end": window_end,
            "wait_days": (min_date - dates[0]).days if min_idx > 0 else 0,
        }

    def recommend_vessel(self, cargo_size: float, route: str, port_constraints: Dict) -> Dict:
        vessel_options = []
        allowed = port_constraints.get("allowed_vessels", ["Capesize", "Panamax", "Supramax"])

        for vessel_class, capacity in self.vessel_capacities.items():
            if vessel_class not in allowed:
                continue
            if capacity < cargo_size:
                continue

            daily_cost = self.vessel_costs[vessel_class]
            voyage_days = self._estimate_voyage_days(route)
            total_cost = daily_cost * voyage_days

            vessel_options.append({
                "vessel_class": vessel_class,
                "capacity": capacity,
                "utilization": cargo_size / capacity,
                "daily_cost": daily_cost,
                "voyage_days": voyage_days,
                "total_cost": total_cost,
                "cost_per_ton": total_cost / cargo_size,
            })

        if not vessel_options:
            return None

        vessel_options.sort(key=lambda x: x["cost_per_ton"])
        best = vessel_options[0]

        return {
            "recommended_vessel": best["vessel_class"],
            "capacity": best["capacity"],
            "utilization": f"{best['utilization'] * 100:.1f}%",
            "estimated_cost": best["total_cost"],
            "cost_per_ton": best["cost_per_ton"],
            "alternatives": vessel_options[1:3],
        }

    def _estimate_voyage_days(self, route: str) -> int:
        route_days = {
            "Australia-East Coast India": 20,
            "South Africa-East Coast India": 18,
            "Indonesia-East Coast India": 15,
            "Brazil-East Coast India": 35,
        }
        return route_days.get(route, 25)

    def assess_risk(self, forecast_data: Dict, port_data: Dict, current_date: datetime) -> Dict:
        risk_factors = []
        risk_score = 0

        if forecast_data.get("upper") and forecast_data.get("lower"):
            avg_uncertainty = np.mean([
                u - l for u, l in zip(forecast_data["upper"], forecast_data["lower"])
            ]) / np.mean(forecast_data["values"])
            if avg_uncertainty > 0.2:
                risk_score += 30
                risk_factors.append("High forecast uncertainty")

        congestion = port_data.get("congestion_level")
        if congestion == "High":
            risk_score += 25
            risk_factors.append("High port congestion")
        elif congestion == "Medium":
            risk_score += 15
            risk_factors.append("Moderate port congestion")

        month = current_date.month
        if month in [6, 7, 8, 9]:
            risk_score += 15
            risk_factors.append("Monsoon season - potential delays")

        volatility = self._calculate_volatility(forecast_data)
        if volatility > 0.12:
            risk_score += 15
            risk_factors.append("High market volatility")

        return {
            "risk_score": min(100, risk_score),
            "risk_level": "Low" if risk_score < 30 else "Medium" if risk_score < 60 else "High",
            "risk_factors": risk_factors,
        }

    def _calculate_volatility(self, forecast_data: Dict) -> float:
        values = np.asarray(forecast_data["values"], dtype=float)
        if len(values) < 2:
            return 0.0
        returns = np.diff(np.log(values + 1e-9))
        return float(np.std(returns)) if len(returns) else 0.0
