# CharterSense 🚢

> **Smart Freight Rate Forecasting & Vessel Charter Optimization for SAIL**
> Built for Smart India Hackathon (SIH) 2026

CharterSense is a full-stack AI-powered platform that helps SAIL (Steel Authority of India Limited) make data-driven decisions on when to charter vessels, which vessel class to use, and what freight rates to expect — minimizing chartering costs through intelligent forecasting.

---

## ✨ Features

- 📈 **Freight Rate Forecasting** — Prophet + ARIMA ensemble model predicting 30/60/90-day freight rate trends
- 🛳️ **Charter Recommendation Engine** — Optimal vessel class and timing suggestions with risk scoring
- 🌐 **Port Compatibility** — Route-wise port suitability and constraints
- 📊 **Risk Advisory Dashboard** — Real-time KPIs, volatility indicators, and market signals
- 🐳 **Dockerized** — Both services containerized and ready to deploy

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI (Python 3.11) |
| **Frontend** | React 18 + Vite + Tailwind CSS |
| **ML Models** | Prophet, ARIMA (statsmodels), scikit-learn |
| **Data** | Synthetic freight market data (Python-generated) |
| **Infra** | Docker |

---

## 🗂️ Project Structure

```
SIH/
├── chartersense-backend/        # FastAPI backend
│   ├── app/
│   │   ├── main.py              # App entry point + CORS
│   │   ├── routes/              # API route handlers
│   │   │   ├── forecast.py
│   │   │   ├── charter.py
│   │   │   └── dashboard.py
│   │   ├── services/            # Business logic
│   │   │   ├── forecast_service.py
│   │   │   ├── optimization_service.py
│   │   │   └── data_generator.py
│   │   └── models/              # Pydantic schemas
│   │       └── freight.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── chartersense-frontend/       # React + Vite frontend
│   ├── src/
│   ├── package.json
│   └── Dockerfile
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd chartersense-backend

# Create and activate virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at → **http://localhost:8000/docs**

### Frontend

```bash
cd chartersense-frontend
npm install
npm run dev
```

Open → **http://localhost:3000**

---

## 🐳 Docker (Optional)

```bash
# Backend
cd chartersense-backend
docker build -t chartersense-backend .
docker run -p 8000:8000 chartersense-backend

# Frontend
cd chartersense-frontend
docker build -t chartersense-frontend .
docker run -p 3000:3000 chartersense-frontend
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/forecast/predict` | Get freight rate forecast |
| `GET` | `/api/forecast/routes` | List available routes |
| `GET` | `/api/forecast/vessel-classes` | List vessel classes |
| `POST` | `/api/charter/recommend` | Get charter recommendation |
| `GET` | `/api/charter/ports` | List ports with metadata |
| `GET` | `/api/dashboard/kpi` | Fetch dashboard KPIs |

---

## 🧪 Demo Flow

1. Select a **route** (e.g., Australia → East Coast India)
2. Select a **vessel class** (Capesize / Panamax / Supramax)
3. Click **Generate Forecast** — see 30/60/90-day rate predictions with confidence bands
4. Click **Get Charter Recommendation** — get optimal charter window + risk score
5. Review the **Dashboard** for live KPIs and market signals

---

## ⚠️ Disclaimer

This is a **synthetic prototype** built for SIH 2026 evaluation. All freight data is procedurally generated for demonstration purposes and does not represent real market data.

---

## 📄 License

[MIT](./LICENSE)
