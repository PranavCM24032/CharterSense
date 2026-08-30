from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import charter, dashboard, forecast

app = FastAPI(
    title="CharterSense AI Platform",
    description="Freight forecasting and vessel charter optimization for SAIL.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forecast.router, prefix="/api/forecast", tags=["forecast"])
app.include_router(charter.router, prefix="/api/charter", tags=["charter"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])


@app.get("/")
async def root():
    return {
        "message": "CharterSense AI Platform",
        "version": "1.0.0",
        "status": "operational",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
