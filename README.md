# CharterSense — Intelligent Freight Rate Forecasting & Vessel Charter Optimization

> **SIH 2026 Problem Statement ID:** 26006  
> **Organization:** Ministry of Steel — Steel Authority of India Limited (SAIL)  
> **Domain:** Software · Maritime Logistics & Supply Chain Procurement

---

## 🚢 Overview

**CharterSense** is an AI-powered decision support platform built for **SAIL (Steel Authority of India Limited)** to optimize ocean freight procurement for bulk raw material imports (coking coal, iron ore, limestone) shipped to the East Coast of India (Visakhapatnam, Paradip, Haldia).

The system replaces manual, error-prone daily market exploration with:
- **Time-Series Forecasting Engine:** Ensembles Seasonal ARIMA and Mean-Reverting regularized models to forecast 60-day freight trajectories across Capesize, Panamax, and Supramax vessels.
- **Port Draft & Berthing Feasibility Solver:** Enforces Salt Water Draft (SWD) limitations and automatically excludes non-feasible vessel classes (e.g. Capesize restrictions at Haldia).
- **Laycan Procurement Optimizer:** Evaluates laytime windows, base freight, late delivery penalties, and congestion demurrage risks to pinpoint the minimum net procurement fixture.
- **Interactive Maritime Radar Map:** Visualizes shipping corridors from major global loading ports (Port Hedland AU, Richards Bay SA, Samarinda ID, Tubarão BR) to Indian discharge terminals.

---

## 💻 Tech Stack

- **Backend:** Python 3 (FastAPI, NumPy, Pandas, Statsmodels ARIMA, Uvicorn)
- **Frontend:** HTML5, CSS3 Enterprise Design System, JavaScript (ES6+), Chart.js & HTML5 Canvas
- **Architecture:** Dual-mode execution (FastAPI Full-Stack & Zero-Dependency Standalone Browser Engine)

---

## 🚀 Getting Started

### Option 1: Full-Stack Mode (FastAPI + Web UI)

1. **Install Dependencies:**
   ```bash
   pip install fastapi uvicorn pandas numpy statsmodels
   ```

2. **Start the Platform:**
   ```bash
   python main.py
   ```

3. **Access in Browser:**
   - Web Platform: [http://localhost:8000](http://localhost:8000)
   - Interactive Swagger API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option 2: Standalone Zero-Server Mode

Simply open `index.html` in any modern web browser. The built-in client engine automatically runs all statistical forecasts, route mappings, and fixture optimizations client-side.

---

## 👥 Authors

Developed for **Smart India Hackathon 2026 (PS 26006)**.
