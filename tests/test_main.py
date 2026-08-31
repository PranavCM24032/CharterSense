from datetime import timedelta

from fastapi.testclient import TestClient

from main import app, sample_data


client = TestClient(app)


def test_health_and_forecast_validation():
    assert client.get("/health").status_code == 200
    assert client.get("/api/dashboard/kpi").status_code == 200
    assert client.post("/api/charter/recommend", json={"cargo_size": -1}).status_code == 422


def test_haldia_excludes_capesize():
    start = (sample_data["date"].max() + timedelta(days=1)).date().isoformat()
    end = (sample_data["date"].max() + timedelta(days=15)).date().isoformat()
    response = client.post("/api/charter/recommend", json={
        "route": "Australia-East Coast India", "port": "Haldia", "cargo_size": 70000,
        "laycan_start": start, "laycan_end": end,
    })
    assert response.status_code == 200
    body = response.json()
    assert body["recommended_vessel"] != "Capesize"
    assert all(item["vessel_class"] != "Capesize" for item in body["alternatives"])
    assert len(body["options"]) == 2
    assert set(body["forecasts"]) == {"Panamax", "Supramax"}
    assert len(body["plan"]) == 30


def test_rejects_invalid_laycan_and_cargo():
    assert client.post("/api/charter/recommend", json={"cargo_size": 0}).status_code == 422
    assert client.post("/api/charter/recommend", json={
        "cargo_size": 10000, "laycan_start": "2026-08-10", "laycan_end": "2026-08-10"
    }).status_code == 422
