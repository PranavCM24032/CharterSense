from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from app.services.data_generator import DataGenerator
from app.services.forecast_service import ForecastService
from app.services.optimization_service import OptimizationService

router = APIRouter()
opt_service = OptimizationService()
forecast_service = ForecastService()
sample_data = DataGenerator.generate_freight_data()
port_data = DataGenerator.generate_port_data()


@router.post("/recommend")
async def get_charter_recommendation(
    route: str,
    vessel_class: str,
    cargo_size: float = Query(..., description="Cargo size in metric tons"),
    port: str = Query(..., description="Destination port"),
):
    try:
        forecast_data = forecast_service.get_forecast(sample_data, route, vessel_class, periods=60)
        if not forecast_data:
            raise HTTPException(404, detail="No forecast data available for the selected route.")

        port_info = port_data[port_data["port_name"] == port].iloc[0].to_dict()
        window = opt_service.calculate_optimal_charter_window(forecast_data, cargo_size)
        vessel_recommendation = opt_service.recommend_vessel(cargo_size, route, port_info)
        risk = opt_service.assess_risk(forecast_data, port_info, datetime.now())

        reason = (
            f"Optimal charter window identified for {route}. Expected {window['saving_percentage']:.1f}% savings by waiting "
            f"{window['wait_days']} days. Recommended vessel: {vessel_recommendation['recommended_vessel']}."
        )

        return {
            "route": route,
            "vessel_class": vessel_class,
            "cargo_size": cargo_size,
            "recommended_vessel": vessel_recommendation["recommended_vessel"],
            "charter_window": {
                "start": window["charter_window_start"],
                "end": window["charter_window_end"],
                "optimal_date": window["optimal_date"],
            },
            "estimated_cost": vessel_recommendation["estimated_cost"],
            "cost_per_ton": vessel_recommendation["cost_per_ton"],
            "risk_score": risk["risk_score"],
            "risk_level": risk["risk_level"],
            "risk_factors": risk["risk_factors"],
            "recommendation_reason": reason,
            "alternatives": vessel_recommendation.get("alternatives", []),
            "capacity": vessel_recommendation.get("capacity"),
            "utilization": vessel_recommendation.get("utilization"),
        }
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/ports")
async def get_ports():
    return {"ports": port_data["port_name"].tolist()}
