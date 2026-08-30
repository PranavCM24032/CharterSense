from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class FreightRate(BaseModel):
    date: datetime
    route: str
    vessel_class: str
    rate: float
    source: str = "synthetic"


class ForecastRequest(BaseModel):
    route: str
    vessel_class: str
    forecast_days: int = 30
    include_confidence: bool = True


class ForecastResponse(BaseModel):
    route: str
    vessel_class: str
    forecast_dates: List[datetime]
    forecast_values: List[float]
    lower_bound: Optional[List[float]] = None
    upper_bound: Optional[List[float]] = None
    confidence_score: float


class CharterRecommendation(BaseModel):
    route: str
    vessel_class: str
    cargo_size: float
    recommended_vessel: str
    charter_window: dict
    estimated_cost: float
    risk_score: float
    recommendation_reason: str


class PortConstraint(BaseModel):
    port_name: str
    max_draft: float
    berth_length: float
    max_vessel_size: str
    congestion_level: str
    average_turnaround: float
    allowed_vessels: List[str]
