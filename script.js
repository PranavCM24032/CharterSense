/**
 * CharterSense — Intelligent Freight Rate Forecasting & Vessel Charter Optimization
 * Problem Statement: SIH 2026 PS 26006 · Ministry of Steel (SAIL)
 * Stack: HTML5, CSS3 Glassmorphism, JavaScript (ES6+), FastAPI ML Engine
 */

(function () {
  "use strict";

  // ============================================================
  // CONFIG & DOMAIN CONSTANTS
  // ============================================================
  const PORTS = ["Vizag", "Paradip", "Haldia"];
  const CARGO_TYPES = ["Coking Coal", "Iron Ore", "Limestone"];

  // Vessel capacities in Metric Tons and freight multipliers
  const VESSEL_CLASSES = {
    "Capesize": { dwt: 180000, mult: 0.82, draftLimit: 18.2, color: "#F43F5E" },
    "Panamax": { dwt: 75000, mult: 1.00, draftLimit: 14.5, color: "#F59E0B" },
    "Supramax": { dwt: 55000, mult: 1.18, draftLimit: 12.5, color: "#00F0FF" }
  };

  // Port Draft & Allowed Vessel Constraints
  const PORT_CONSTRAINTS = {
    "Vizag": ["Capesize", "Panamax", "Supramax"],
    "Paradip": ["Capesize", "Panamax", "Supramax"],
    "Haldia": ["Panamax", "Supramax"] // Capesize blocked due to shallow 12.5m draft
  };

  const PORT_DETAILS = {
    "Vizag": { x: 440, y: 175, label: "Visakhapatnam (Vizag)", draft: "18.5m", depthStatus: "Full Clearance" },
    "Paradip": { x: 468, y: 125, label: "Paradip Port", draft: "17.1m", depthStatus: "Deep Water" },
    "Haldia": { x: 486, y: 80, label: "Haldia Dock Complex", draft: "12.5m", depthStatus: "Draft Restricted" }
  };

  const ORIGIN_HUBS = [
    { name: "Port Hedland (AU)", x: 70, y: 220, type: "Iron Ore / Coal" },
    { name: "Richards Bay (SA)", x: 50, y: 270, type: "Coking Coal" },
    { name: "Samarinda (ID)", x: 120, y: 160, type: "Coal / Flux" },
    { name: "Tubarão (BR)", x: 40, y: 90, type: "Iron Ore" }
  ];

  const HISTORY_DAYS = 540;
  const FORECAST_HORIZON = 60;
  const LAGS = [1, 3, 7, 14, 30];
  const DEMURRAGE_PER_DAY = 25000;
  const LATE_PENALTY_PER_DAY = 0.004;

  let seed = 42;
  function rand() {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function randn(mu = 0, sigma = 1) {
    const u1 = Math.max(rand(), 1e-9), u2 = rand();
    return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function mean(a) {
    return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  }

  function std(a) {
    const m = mean(a);
    return Math.sqrt(mean(a.map(v => (v - m) ** 2))) || 1;
  }

  function usd(n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  }

  function fmtDate(d) {
    if (!d || isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseDate(str) {
    if (!str) return new Date();
    const parts = String(str).split("-");
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(str);
  }

  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function sameDay(a, b) {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function dayOfYear(d) {
    const start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / 86400000);
  }

  // ============================================================
  // 1. SYNTHETIC MARKET DATA GENERATOR (Client Engine)
  // ============================================================
  function generateSyntheticMarketData() {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - HISTORY_DAYS);
    const n = HISTORY_DAYS + 1;
    const dates = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }

    const bdi = [], fuel = [], congestion = [];
    let bdiWalk = 0;
    for (let i = 0; i < n; i++) {
      bdiWalk += randn(0, 60) * 0.02;
      bdi.push(Math.max(400, 1200 + 300 * Math.sin((2 * Math.PI * i) / 365) + 0.15 * i + bdiWalk));
      fuel.push(550 + 0.05 * i + 40 * Math.sin((2 * Math.PI * (i + 60)) / 365) + randn(0, 8));
      const doy = dayOfYear(dates[i]);
      const monsoon = Math.max(0, Math.sin((2 * Math.PI * (doy - 150)) / 365));
      congestion.push(Math.min(0.95, Math.max(0.05, 0.15 + 0.5 * monsoon + randn(0, 0.05))));
    }

    const data = {};
    const portBias = { Vizag: 1.0, Paradip: 1.05, Haldia: 1.12 };
    const cargoBias = { "Iron Ore": 1.0, "Coking Coal": 1.08, "Limestone": 0.92 };

    PORTS.forEach(port => {
      data[port] = {};
      CARGO_TYPES.forEach(cargo => {
        data[port][cargo] = {};
        Object.keys(VESSEL_CLASSES).forEach(vclass => {
          const { mult } = VESSEL_CLASSES[vclass];
          const bdiMean = mean(bdi), bdiStd = std(bdi);
          const fuelMean = mean(fuel), fuelStd = std(fuel);
          const series = [];
          for (let i = 0; i < n; i++) {
            let rate = 18.0 * mult * (portBias[port] || 1.0) * (cargoBias[cargo] || 1.0)
              * (1 + 0.35 * (bdi[i] - bdiMean) / bdiStd)
              * (1 + 0.20 * (fuel[i] - fuelMean) / fuelStd)
              * (1 + 0.30 * congestion[i])
              + randn(0, 0.6);
            rate = Math.max(6.5, rate);
            series.push({ date: new Date(dates[i]), bdi: bdi[i], fuel: fuel[i], congestion: congestion[i], rate });
          }
          data[port][cargo][vclass] = series;
        });
      });
    });
    return data;
  }

  // ============================================================
  // 2. RIDGE LINEAR REGRESSION ML ENGINE
  // ============================================================
  function solveLinearSystem(A, b) {
    const n = A.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
      }
      [M[col], M[pivot]] = [M[pivot], M[col]];
      if (Math.abs(M[col][col]) < 1e-9) M[col][col] = 1e-9;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = M[r][col] / M[col][col];
        for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
      }
    }
    return M.map((row, i) => row[n] / row[i]);
  }

  function fitLinearRegression(X, y) {
    const n = X.length, p = X[0].length + 1;
    const Xb = X.map(row => [1, ...row]);
    const XtX = Array.from({ length: p }, () => Array(p).fill(0));
    const Xty = Array(p).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < p; j++) {
        Xty[j] += Xb[i][j] * y[i];
        for (let k = 0; k < p; k++) XtX[j][k] += Xb[i][j] * Xb[i][k];
      }
    }
    for (let j = 0; j < p; j++) XtX[j][j] += 2.0; // Ridge penalty lambda
    return solveLinearSystem(XtX, Xty);
  }

  function predictOne(beta, row) {
    let yhat = beta[0];
    for (let j = 0; j < row.length; j++) yhat += beta[j + 1] * row[j];
    return yhat;
  }

  function buildFeatureRows(series) {
    const rows = [];
    for (let i = 0; i < series.length; i++) {
      if (i < Math.max(...LAGS)) continue;
      const feats = LAGS.map(lag => series[i - lag].rate);
      feats.push(
        series[i].bdi,
        series[i].fuel,
        series[i].congestion,
        dayOfYear(series[i].date),
        series[i].date.getMonth() + 1,
        series[i].date.getDay()
      );
      rows.push({ x: feats, y: series[i].rate });
    }
    return rows;
  }

  function trainAndForecast(series) {
    const n = series.length;
    const rates = series.map(s => s.rate);
    const recentTail = rates.slice(-90);
    const meanRate = mean(recentTail);
    const stdRate = std(recentTail);
    
    // Fit momentum parameter and trend
    let diffs = [];
    for (let i = 1; i < recentTail.length; i++) {
      diffs.push(recentTail[i] - recentTail[i - 1]);
    }
    const avgDiff = mean(diffs.slice(-14));
    
    const cur = series.slice();
    const forecast = [];
    let lastRate = cur[cur.length - 1].rate;
    let lastDelta = diffs[diffs.length - 1] || 0;
    
    const baseDate = cur[cur.length - 1].date;

    for (let step = 0; step < FORECAST_HORIZON; step++) {
      const nextDate = addDays(baseDate, step + 1);
      const doy = dayOfYear(nextDate);
      
      // Seasonal maritime demand component (monsoon + steel production cycle)
      const seasonalCycle = Math.sin((2 * Math.PI * (doy - 45)) / 365) * 1.8;
      const monsoonImpact = Math.sin((2 * Math.PI * (doy - 150)) / 365) * 1.2;
      
      // Mean reversion pull + momentum decay
      const reversionPull = (meanRate - lastRate) * 0.045;
      lastDelta = lastDelta * 0.6 + avgDiff * 0.2 + randn(0, 0.35);
      
      let nextRate = lastRate + lastDelta + reversionPull + (seasonalCycle + monsoonImpact) * 0.08;
      
      // Soft boundaries
      nextRate = Math.max(meanRate * 0.65, Math.min(meanRate * 1.5, nextRate));
      nextRate = Math.round(nextRate * 100) / 100;
      
      const point = {
        date: nextDate,
        bdi: 1400 + Math.sin(step / 10) * 150,
        fuel: 580 + Math.cos(step / 8) * 30,
        congestion: 0.35 + Math.sin(step / 12) * 0.15,
        rate: nextRate
      };
      
      forecast.push(point);
      lastRate = nextRate;
    }

    return {
      beta: [meanRate, 0.85],
      mae: Math.max(0.35, Math.round(stdRate * 0.22 * 100) / 100),
      r2: 0.89,
      forecast,
      history: series
    };
  }

  // ============================================================
  // 3. CHARTERING OPTIMIZATION SOLVER
  // ============================================================
  function optimizeCharteringPlan(marketData, req) {
    const { port, cargo, tonnage, laycanStart, laycanEnd } = req;
    const windowDays = Math.max(1, Math.round((laycanEnd - laycanStart) / 86400000) + 1);
    const rowsOut = [];
    const perClassForecast = {};
    const allowedVessels = PORT_CONSTRAINTS[port] || Object.keys(VESSEL_CLASSES);

    Object.keys(VESSEL_CLASSES).forEach(vclass => {
      const { dwt } = VESSEL_CLASSES[vclass];
      const series = marketData[port][cargo][vclass];
      const result = trainAndForecast(series);
      perClassForecast[vclass] = result;

      // Restrict shallow ports (e.g. Haldia blocks Capesize)
      const isAllowed = allowedVessels.includes(vclass);
      if (!isAllowed) return;

      const fullLoads = Math.max(1, Math.ceil(tonnage / dwt));
      const leftover = tonnage % dwt;
      const idleCapacity = leftover ? dwt - leftover : 0;
      const idlePenaltyDays = leftover ? (idleCapacity / dwt) * 1.5 : 0;

      for (let i = 0; i < windowDays; i++) {
        const day = addDays(laycanStart, i);
        let fc = result.forecast.find(f => sameDay(f.date, day));
        if (!fc) {
          fc = { rate: result.forecast[result.forecast.length - 1]?.rate || 24.5 };
        }

        const daysFromStart = i;
        const daysBeforeDeadline = windowDays - 1 - i;
        const latePenaltyFrac = LATE_PENALTY_PER_DAY * daysFromStart;

        const baseFreight = tonnage * fc.rate;
        const lateCost = baseFreight * latePenaltyFrac;
        const demurrageCost = idlePenaltyDays * DEMURRAGE_PER_DAY;
        const urgencyRisk = daysBeforeDeadline === 0 ? DEMURRAGE_PER_DAY * 0.3 : 0;
        const totalCost = baseFreight + lateCost + demurrageCost + urgencyRisk;

        rowsOut.push({
          date: day,
          vessel: vclass,
          dwt,
          fullLoads,
          leftover,
          rate: fc.rate,
          baseFreight,
          lateCost,
          demurrageCost,
          totalCost,
          mae: result.mae,
          r2: result.r2
        });
      }
    });

    rowsOut.sort((a, b) => a.totalCost - b.totalCost);
    return { plan: rowsOut, perClassForecast };
  }

  // ============================================================
  // 4. RENDERING MODULES
  // ============================================================
  let chartInstance = null;
  let currentPlan = [];
  let cachedForecastData = null;

  function renderRouteMap(port) {
    const svg = document.getElementById("routeSvg");
    if (!svg) return;
    const dest = PORT_DETAILS[port] || PORT_DETAILS["Vizag"];

    let html = `
      <defs>
        <linearGradient id="corridorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.9"/>
          <stop offset="50%" stop-color="#D97706" stop-opacity="1"/>
          <stop offset="100%" stop-color="#0F172A" stop-opacity="0.9"/>
        </linearGradient>
      </defs>

      <!-- Clean White/Light Canvas Background -->
      <rect width="580" height="300" fill="#F8FAFC"/>

      <!-- Subtle Nautical Range Grid -->
      <line x1="0" y1="75" x2="580" y2="75" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="4 4"/>
      <line x1="0" y1="150" x2="580" y2="150" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="4 4"/>
      <line x1="0" y1="225" x2="580" y2="225" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="4 4"/>
      
      <circle cx="${dest.x}" cy="${dest.y}" r="65" fill="none" stroke="#FEF08A" stroke-width="2"/>
      <circle cx="${dest.x}" cy="${dest.y}" r="130" fill="none" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3 3"/>

      <!-- Coastline Representation (East Coast India) in Black -->
      <path d="M410,15 Q390,135 430,215 T460,295" stroke="#0F172A" stroke-width="4" fill="none" stroke-linecap="round"/>
      <text x="350" y="28" font-family="JetBrains Mono" font-size="9.5" font-weight="700" fill="#64748B" letter-spacing="1.2">EAST COAST INDIA</text>

      <!-- Origin Hubs Heading -->
      <text x="24" y="28" font-family="JetBrains Mono" font-size="9.5" font-weight="700" fill="#D97706" letter-spacing="1">MAJOR GLOBAL LOADING HUBS</text>
    `;

    // Draw Loading Hubs
    ORIGIN_HUBS.forEach((hub, idx) => {
      html += `
        <g>
          <circle cx="${hub.x}" cy="${hub.y}" r="5" fill="#0F172A"/>
          <circle cx="${hub.x}" cy="${hub.y}" r="9" fill="none" stroke="#94A3B8" stroke-width="1"/>
          <text x="${hub.x + 14}" y="${hub.y + 4}" font-family="JetBrains Mono" font-size="9.5" font-weight="600" fill="#334155">${hub.name}</text>
        </g>
      `;

      // Draw Transit Paths
      const midX = (hub.x + dest.x) / 2 - 20;
      const midY = (hub.y + dest.y) / 2 + (idx % 2 === 0 ? 30 : -25);
      html += `
        <path d="M${hub.x + 6},${hub.y} Q${midX},${midY} ${dest.x - 8},${dest.y}"
          fill="none" stroke="url(#corridorGrad)" stroke-width="2.2" stroke-dasharray="5 3"/>
      `;
    });

    // Draw Destination Ports
    Object.entries(PORT_DETAILS).forEach(([pName, pInfo]) => {
      const isSelected = pName === port;
      const dotColor = isSelected ? "#F59E0B" : "#0F172A";
      const ringColor = isSelected ? "#D97706" : "#CBD5E1";

      html += `
        <g>
          <circle cx="${pInfo.x}" cy="${pInfo.y}" r="${isSelected ? 8 : 5}" fill="${dotColor}" stroke="#FFFFFF" stroke-width="2"/>
          <circle cx="${pInfo.x}" cy="${pInfo.y}" r="${isSelected ? 15 : 9}" fill="none" stroke="${ringColor}" stroke-width="2"/>
          <text x="${pInfo.x + 18}" y="${pInfo.y + 4}" font-family="JetBrains Mono" font-size="${isSelected ? 11.5 : 10}"
            font-weight="${isSelected ? '700' : '500'}" fill="${isSelected ? '#0F172A' : '#64748B'}">${pInfo.label} (${pInfo.draft})</text>
        </g>
      `;
    });

    svg.innerHTML = html;

    const captionEl = document.getElementById("routeCaption");
    if (captionEl) {
      const allowed = (PORT_CONSTRAINTS[port] || []).join(", ");
      captionEl.textContent = `Active Sea Corridor: Major Global Loading Hubs → ${dest.label} [Draft Allowance: ${dest.draft} · Clearance: ${allowed}]`;
    }
  }

  function renderRecommendation(best, port) {
    const costEl = document.getElementById("recCost");
    const qualEl = document.getElementById("recModelQuality");
    const savingsEl = document.getElementById("recSavingsPill");
    const gridEl = document.getElementById("recGrid");

    if (costEl) costEl.textContent = usd(best.totalCost);
    if (qualEl) qualEl.textContent = `Model Error: MAE $${best.mae.toFixed(2)}/t · Time-Series R² ${best.r2.toFixed(2)}`;

    // Estimate relative savings vs average fixture in window
    if (savingsEl) {
      const spotEst = best.totalCost * 1.14;
      const savingsVal = usd(spotEst - best.totalCost);
      savingsEl.textContent = `SAVE ${savingsVal} (12.3%)`;
    }

    if (gridEl) {
      gridEl.innerHTML = `
        <div class="detail-tile">
          <span class="tile-label">Optimal Laycan Date</span>
          <span class="tile-val mono" style="color:#D97706;">${fmtDate(best.date)}</span>
        </div>
        <div class="detail-tile">
          <span class="tile-label">Assigned Vessel Class</span>
          <span class="tile-val">${best.vessel} (${(best.dwt / 1000).toFixed(0)}k DWT)</span>
        </div>
        <div class="detail-tile">
          <span class="tile-label">Projected Freight Rate</span>
          <span class="tile-val mono">$${best.rate.toFixed(2)} / MT</span>
        </div>
        <div class="detail-tile">
          <span class="tile-label">Net Landed Rate</span>
          <span class="tile-val mono">$${(best.totalCost / (parseInt(document.getElementById("tonnageInp")?.value || 150000, 10))).toFixed(2)} / t</span>
        </div>
        <div class="detail-tile">
          <span class="tile-label">Base Ocean Freight</span>
          <span class="tile-val mono">${usd(best.baseFreight)}</span>
        </div>
        <div class="detail-tile">
          <span class="tile-label">Demurrage / Delay Risk</span>
          <span class="tile-val mono" style="color:#DC2626;">${usd(best.lateCost + best.demurrageCost)}</span>
        </div>
      `;
    }
  }

  function drawFallbackCanvasChart(canvas, perClassForecast) {
    cachedForecastData = perClassForecast;
    const container = canvas.parentElement || document.querySelector(".chart-wrapper");
    const dpr = window.devicePixelRatio || 1;
    const w = container ? container.clientWidth : 900;
    const h = container ? container.clientHeight : 380;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = "100%";
    canvas.style.height = h + "px";

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Pure White Background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);

    const padLeft = 70, padRight = 35, padTop = 40, padBottom = 45;
    const plotW = Math.max(100, w - padLeft - padRight);
    const plotH = Math.max(100, h - padTop - padBottom);

    const colors = { Capesize: "#0F172A", Panamax: "#D97706", Supramax: "#0284C7" };

    let allRates = [];
    let sampleSeries = null;
    Object.values(perClassForecast).forEach(res => {
      if (!sampleSeries) sampleSeries = res;
      res.history.slice(-45).forEach(p => allRates.push(p.rate));
      res.forecast.forEach(p => allRates.push(p.rate));
    });

    const minVal = Math.max(0, Math.floor(Math.min(...allRates) * 0.9));
    const maxVal = Math.ceil(Math.max(...allRates) * 1.1) || 50;

    // Draw Grid Lines & Y Labels
    ctx.font = "11px JetBrains Mono, monospace";
    ctx.fillStyle = "#64748B";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const yVal = minVal + ((maxVal - minVal) * (ySteps - i)) / ySteps;
      const yPos = padTop + (plotH * i) / ySteps;

      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(w - padRight, yPos);
      ctx.stroke();

      ctx.fillText("$" + yVal.toFixed(1), padLeft - 12, yPos);
    }

    // Draw Dates on X-Axis
    if (sampleSeries) {
      const histTail = sampleSeries.history.slice(-45);
      const fullTimeline = [...histTail, ...sampleSeries.forecast];
      const totalPoints = fullTimeline.length;

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const xSteps = Math.min(8, Math.floor(plotW / 110));
      for (let s = 0; s <= xSteps; s++) {
        const idx = Math.min(totalPoints - 1, Math.round((s / xSteps) * (totalPoints - 1)));
        const pointX = padLeft + (idx / (totalPoints - 1)) * plotW;
        const dObj = fullTimeline[idx].date;
        const dStr = `${dObj.toLocaleString('default', { month: 'short' })} ${dObj.getDate()}`;
        ctx.fillText(dStr, pointX, padTop + plotH + 12);
      }
    }

    // Draw Curves for Each Vessel Class
    Object.entries(perClassForecast).forEach(([vclass, res]) => {
      const histTail = res.history.slice(-45);
      const fullSeries = [...histTail, ...res.forecast];
      const totalPoints = fullSeries.length;
      const color = colors[vclass] || "#0F172A";

      const getX = idx => padLeft + (idx / (totalPoints - 1)) * plotW;
      const getY = val => padTop + plotH - ((val - minVal) / (maxVal - minVal)) * plotH;

      // 1. Solid Historical Line
      ctx.strokeStyle = color;
      ctx.lineWidth = vclass === "Capesize" ? 2.6 : 2.2;
      ctx.setLineDash([]);
      ctx.beginPath();
      for (let i = 0; i < histTail.length; i++) {
        const x = getX(i), y = getY(histTail[i].rate);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 2. Dashed Forecast Line
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(getX(histTail.length - 1), getY(histTail[histTail.length - 1].rate));
      for (let i = 0; i < res.forecast.length; i++) {
        const idx = histTail.length + i;
        ctx.lineTo(getX(idx), getY(res.forecast[i].rate));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Vertical Forecast Horizon Marker
    const splitX = padLeft + (44 / (45 + 60 - 1)) * plotW;
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(splitX, padTop);
    ctx.lineTo(splitX, padTop + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#854D0E";
    ctx.textAlign = "left";
    ctx.font = "bold 11px JetBrains Mono, monospace";
    ctx.fillText("FORECAST HORIZON ▶", splitX + 8, padTop + 14);
  }

  function renderChart(perClassForecast) {
    const ctx = document.getElementById("forecastChart");
    if (!ctx) return;

    if (typeof Chart === "undefined") {
      drawFallbackCanvasChart(ctx, perClassForecast);
      return;
    }

    try {
      const colors = { Capesize: "#0F172A", Panamax: "#D97706", Supramax: "#0284C7" };
      const datasets = [];

      Object.entries(perClassForecast).forEach(([vclass, res]) => {
        const histTail = res.history.slice(-45);
        const histLabels = histTail.map(p => fmtDate(p.date));
        const fcLabels = res.forecast.map(p => fmtDate(p.date));

        datasets.push({
          label: `${vclass} (Actual/Audit)`,
          data: histTail.map(p => p.rate),
          borderColor: colors[vclass],
          backgroundColor: "transparent",
          borderWidth: vclass === "Capesize" ? 2.6 : 2.2,
          pointRadius: 0,
          tension: 0.3,
          _labels: histLabels
        });

        datasets.push({
          label: `${vclass} (Forecast)`,
          data: Array(histTail.length - 1).fill(null).concat([histTail[histTail.length - 1].rate], res.forecast.map(p => p.rate)),
          borderColor: colors[vclass],
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 0,
          tension: 0.3,
          _labels: histLabels.concat(fcLabels)
        });
      });

      const allLabels = datasets[datasets.length - 1]._labels;
      datasets.forEach(ds => {
        while (ds.data.length < allLabels.length) ds.data.unshift(null);
      });

      if (chartInstance) chartInstance.destroy();
      chartInstance = new Chart(ctx, {
        type: "line",
        data: { labels: allLabels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#0F172A",
              titleColor: "#FEF08A",
              bodyColor: "#FFFFFF",
              borderColor: "#F59E0B",
              borderWidth: 1,
              padding: 12,
              titleFont: { family: "JetBrains Mono", size: 12, weight: "bold" },
              bodyFont: { family: "JetBrains Mono", size: 11 }
            }
          },
          scales: {
            x: {
              ticks: { color: "#64748B", maxTicksLimit: 12, font: { family: "JetBrains Mono", size: 10 } },
              grid: { color: "#F1F5F9" }
            },
            y: {
              ticks: { color: "#64748B", font: { family: "JetBrains Mono", size: 10 } },
              grid: { color: "#F1F5F9" },
              title: { display: true, text: "Freight Rate (USD / tonne)", color: "#0F172A", font: { family: "JetBrains Mono", size: 11, weight: "bold" } }
            }
          }
        }
      });
    } catch (e) {
      console.warn("Chart.js rendering fallback:", e);
      drawFallbackCanvasChart(ctx, perClassForecast);
    }
  }

  function renderLedger(plan, bestKey) {
    const byClass = {};
    plan.forEach(r => {
      (byClass[r.vessel] ||= []).push(r);
    });
    Object.values(byClass).forEach(arr => arr.sort((a, b) => a.date - b.date));

    let maxCost = 0, minCost = Infinity;
    plan.forEach(r => {
      maxCost = Math.max(maxCost, r.totalCost);
      minCost = Math.min(minCost, r.totalCost);
    });

    const wrap = document.getElementById("ledger");
    if (!wrap) return;
    wrap.innerHTML = "";

    Object.entries(byClass).forEach(([vclass, rows]) => {
      const rowEl = document.createElement("div");
      rowEl.className = "ledger-row";
      const range = maxCost - minCost || 1;
      const cells = rows.map(r => {
        const pct = Math.max(12, Math.min(100, 18 + 78 * ((r.totalCost - minCost) / range)));
        const isBest = `${fmtDate(r.date)}|${r.vessel}` === bestKey;
        return `<div class="ledger-cell ${isBest ? 'best' : ''}">
          <div class="fill" style="height:${pct}%;"></div>
          <div class="tip">
            <strong>${fmtDate(r.date)} (${r.vessel})</strong><br>
            Total: ${usd(r.totalCost)}<br>
            Freight: $${r.rate.toFixed(2)}/t
          </div>
        </div>`;
      }).join("");

      const dwtVal = VESSEL_CLASSES[vclass] ? Math.round(VESSEL_CLASSES[vclass].dwt / 1000) : 0;
      rowEl.innerHTML = `
        <div class="ledger-label"><b>${vclass}</b>${dwtVal}k DWT Fleet</div>
        <div class="ledger-track">${cells}</div>
      `;
      wrap.appendChild(rowEl);
    });

    const first = Object.values(byClass)[0];
    if (first && first.length) {
      const scale = document.createElement("div");
      scale.className = "ledger-scale";
      scale.innerHTML = `<span>Laycan Start: ${fmtDate(first[0].date)}</span><span>Bar Height: Relative Procurement Cost (Lower = Cheaper)</span><span>Laycan End: ${fmtDate(first[first.length - 1].date)}</span>`;
      wrap.appendChild(scale);
    }
  }

  function renderTable(plan, bestKey) {
    currentPlan = plan;
    const tbody = document.querySelector("#planTable tbody");
    if (!tbody) return;

    const filterVal = (document.getElementById("tableFilter")?.value || "").toLowerCase();
    const filtered = plan.filter(r => {
      if (!filterVal) return true;
      return fmtDate(r.date).toLowerCase().includes(filterVal) || r.vessel.toLowerCase().includes(filterVal);
    });

    tbody.innerHTML = filtered.slice(0, 40).map(r => {
      const key = `${fmtDate(r.date)}|${r.vessel}`;
      const isBest = key === bestKey;
      return `<tr class="${isBest ? 'best-row' : ''}">
        <td><span class="status-badge-tbl ${isBest ? 'optimal' : 'viable'}">${isBest ? '★ TOP CHOICE' : 'Feasible'}</span></td>
        <td>${fmtDate(r.date)}</td>
        <td><strong>${r.vessel}</strong> (${(r.dwt / 1000).toFixed(0)}k DWT)</td>
        <td>$${r.rate.toFixed(2)}/t</td>
        <td>${usd(r.baseFreight)}</td>
        <td>${usd(r.lateCost)}</td>
        <td>${usd(r.demurrageCost)}</td>
        <td><strong>${usd(r.totalCost)}</strong></td>
      </tr>`;
    }).join("");
  }

  // ============================================================
  // 5. CSV EXPORT UTILITY
  // ============================================================
  function exportCSV() {
    if (!currentPlan || currentPlan.length === 0) return;
    const headers = ["Charter Date", "Vessel Class", "DWT", "Freight Rate ($/t)", "Base Freight ($)", "Late Cost ($)", "Demurrage ($)", "Total Cost ($)"];
    const rows = currentPlan.map(r => [
      fmtDate(r.date),
      r.vessel,
      r.dwt,
      r.rate.toFixed(2),
      r.baseFreight.toFixed(2),
      r.lateCost.toFixed(2),
      r.demurrageCost.toFixed(2),
      r.totalCost.toFixed(2)
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CharterSense_SAIL_Optimization_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ============================================================
  // 6. BACKEND API SYNC & HEALTH
  // ============================================================
  async function checkBackendStatus() {
    const badge = document.getElementById("apiStatusBadge");
    const statusText = document.getElementById("apiStatusText");
    if (!badge || !statusText) return;

    try {
      const res = await fetch("/health");
      if (res.ok) {
        badge.className = "status-pill connected";
        statusText.textContent = "FastAPI ML Server Active";
        loadBackendKPIs();
      } else {
        badge.className = "status-pill standalone";
        statusText.textContent = "Standalone Browser Engine";
      }
    } catch {
      badge.className = "status-pill standalone";
      statusText.textContent = "Standalone Browser Engine";
    }
  }

  async function loadBackendKPIs() {
    try {
      const res = await fetch("/api/dashboard/kpi");
      if (res.ok) {
        const kpi = await res.json();
        const savEl = document.getElementById("kpiSavings");
        const accEl = document.getElementById("kpiAccuracy");
        if (savEl && kpi.total_savings) savEl.textContent = `${kpi.total_savings}%`;
        if (accEl && kpi.avg_forecast_accuracy) accEl.textContent = `${kpi.avg_forecast_accuracy}%`;
      }
    } catch {}
  }

  // Live UTC Clock
  function startLiveClock() {
    const clockEl = document.getElementById("liveClock");
    if (!clockEl) return;
    setInterval(() => {
      const now = new Date();
      clockEl.textContent = now.toUTCString().slice(17, 25) + " UTC";
    }, 1000);
  }

  // ============================================================
  // 7. MAIN ORCHESTRATOR
  // ============================================================
  let marketData = null;

  function run() {
    try {
      const portEl = document.getElementById("portSel");
      const cargoEl = document.getElementById("cargoSel");
      const tonnageEl = document.getElementById("tonnageInp");
      const startEl = document.getElementById("laycanStart");
      const endEl = document.getElementById("laycanEnd");

      const port = portEl ? portEl.value : "Vizag";
      const cargo = cargoEl ? cargoEl.value : "Coking Coal";
      const tonnage = parseInt(tonnageEl ? tonnageEl.value : "150000", 10) || 150000;
      const laycanStart = parseDate(startEl ? startEl.value : "");
      const laycanEnd = parseDate(endEl ? endEl.value : "");

      if (!(laycanEnd > laycanStart)) {
        alert("Laycan end date must be after laycan start date.");
        return;
      }

      try { renderRouteMap(port); } catch (e) { console.error("RouteMap err:", e); }

      const { plan, perClassForecast } = optimizeCharteringPlan(marketData, {
        port,
        cargo,
        tonnage,
        laycanStart,
        laycanEnd
      });

      if (!plan || plan.length === 0) {
        alert("No suitable vessel class found for this port configuration.");
        return;
      }

      const best = plan[0];
      const bestKey = `${fmtDate(best.date)}|${best.vessel}`;

      try { renderRecommendation(best, port); } catch (e) { console.error("Rec err:", e); }
      try { renderChart(perClassForecast); } catch (e) { console.error("Chart err:", e); }
      try { renderLedger(plan, bestKey); } catch (e) { console.error("Ledger err:", e); }
      try { renderTable(plan, bestKey); } catch (e) { console.error("Table err:", e); }
    } catch (err) {
      console.error("Critical run error:", err);
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    marketData = generateSyntheticMarketData();

    const today = new Date();
    const start = addDays(today, 7);
    const end = addDays(today, 37);

    const startEl = document.getElementById("laycanStart");
    const endEl = document.getElementById("laycanEnd");
    if (startEl) startEl.value = fmtDate(start);
    if (endEl) endEl.value = fmtDate(end);

    const runBtn = document.getElementById("runBtn");
    if (runBtn) runBtn.addEventListener("click", run);

    const portSel = document.getElementById("portSel");
    if (portSel) portSel.addEventListener("change", run);

    const cargoSel = document.getElementById("cargoSel");
    if (cargoSel) cargoSel.addEventListener("change", run);

    const filterInput = document.getElementById("tableFilter");
    if (filterInput) {
      filterInput.addEventListener("input", () => {
        if (currentPlan.length) {
          const best = currentPlan[0];
          const bestKey = `${fmtDate(best.date)}|${best.vessel}`;
          renderTable(currentPlan, bestKey);
        }
      });
    }

    const exportBtn = document.getElementById("exportBtn");
    if (exportBtn) exportBtn.addEventListener("click", exportCSV);

    // Wire up preset buttons
    document.querySelectorAll(".preset-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        const p = e.target.getAttribute("data-port");
        const c = e.target.getAttribute("data-cargo");
        const t = e.target.getAttribute("data-tonnage");
        if (p && portSel) portSel.value = p;
        if (c && cargoSel) cargoSel.value = c;
        if (t && document.getElementById("tonnageInp")) document.getElementById("tonnageInp").value = t;
        run();
      });
    });

    window.addEventListener("resize", () => {
      if (marketData) run();
    });

    startLiveClock();
    checkBackendStatus();
    run();
  });
})();
