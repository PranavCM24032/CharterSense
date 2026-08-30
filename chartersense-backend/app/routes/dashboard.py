from fastapi import APIRouter

router = APIRouter()


@router.get("/kpi")
async def get_kpi():
    return {
        "total_savings": 12.5,
        "avg_forecast_accuracy": 87,
        "recommended_vessels": 4,
        "risk_alerts": 2,
        "active_trades": 6,
        "cost_per_ton": 32.5,
    }
