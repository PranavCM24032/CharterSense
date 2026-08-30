from fastapi import APIRouter, HTTPException

from app.models.freight import ForecastRequest
from app.services.data_generator import DataGenerator
from app.services.forecast_service import ForecastService

router = APIRouter()
forecast_service = ForecastService()
sample_data = DataGenerator.generate_freight_data()


@router.post("/predict")
async def get_forecast(request: ForecastRequest):
    try:
        forecast_result = forecast_service.get_forecast(
            sample_data,
            request.route,
            request.vessel_class,
            request.forecast_days,
        )

        if not forecast_result:
            raise HTTPException(404, detail="Not enough historical data for this route and vessel.")

        return {
            "route": request.route,
            "vessel_class": request.vessel_class,
            "forecast_dates": forecast_result["dates"],
            "forecast_values": forecast_result["values"],
            "lower_bound": forecast_result["lower"],
            "upper_bound": forecast_result["upper"],
            "confidence_score": 0.85,
        }
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/routes")
async def get_routes():
    return {"routes": [
        "Australia-East Coast India",
        "South Africa-East Coast India",
        "Indonesia-East Coast India",
        "Brazil-East Coast India",
    ]}


@router.get("/vessel-classes")
async def get_vessel_classes():
    return {"vessel_classes": ["Capesize", "Panamax", "Supramax"]}


@router.get("/historical/{route}/{vessel_class}")
async def get_historical_data(route: str, vessel_class: str, days: int = 180):
    filtered = sample_data[
        (sample_data["route"] == route) & (sample_data["vessel_class"] == vessel_class)
    ].tail(days)
    return {"data": filtered.to_dict("records")}
