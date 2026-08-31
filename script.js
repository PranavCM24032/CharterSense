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

  // ============================================================
  // 3. RENDERING MODULES
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
    if (qualEl) qualEl.textContent = "Forecast generated by the validated server-side ARIMA model";

    // Estimate relative savings vs average fixture in window
    if (savingsEl) {
      savingsEl.textContent = "LOWEST MODELLED COST";
    }

    if (gridEl) {
      gridEl.innerHTML = `
        <div class="detail-tile">
          <span class="tile-label">Optimal Laycan Date</span>
          <span class="tile-val mono" style="color:#D97706;">${fmtDate(best.date)}</span>
        </div>
        <div class="detail-tile">
          <span class="tile-label">Selected Laycan Window</span>
          <span class="tile-val mono">${best.requestedLaycan || "Not available"}</span>
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
          data: histTail.map(p => p.rate).concat(Array(fcLabels.length).fill(null)),
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

      const firstSeries = Object.values(perClassForecast)[0];
      const allLabels = firstSeries.history.slice(-45).map(p => fmtDate(p.date))
        .concat(firstSeries.forecast.map(p => fmtDate(p.date)));

      if (chartInstance) chartInstance.destroy();
      chartInstance = new Chart(ctx, {
        type: "line",
        data: { labels: allLabels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          devicePixelRatio: window.devicePixelRatio || 1,
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
        const tipText = `${fmtDate(r.date)} (${r.vessel}) — Total: ${usd(r.totalCost)} · Freight: $${r.rate.toFixed(2)}/t`;
        return `<div class="ledger-cell ${isBest ? 'best' : ''}" data-tip="${tipText.replace(/"/g, '&quot;')}">
          <div class="fill" style="height:${pct}%;"></div>
        </div>`;
      }).join("");

      const dwtVal = VESSEL_CLASSES[vclass] ? Math.round(VESSEL_CLASSES[vclass].dwt / 1000) : 0;
      rowEl.innerHTML = `
        <div class="ledger-label"><b>${vclass}</b>${dwtVal}k DWT Fleet</div>
        <div class="ledger-track">${cells}</div>
      `;
      wrap.appendChild(rowEl);
    });

    wireLedgerTooltips(wrap);

    const first = Object.values(byClass)[0];
    if (first && first.length) {
      const scale = document.createElement("div");
      scale.className = "ledger-scale";
      scale.innerHTML = `<span>Laycan Start: ${fmtDate(first[0].date)}</span><span>Bar Height: Relative Procurement Cost (Lower = Cheaper)</span><span>Laycan End: ${fmtDate(first[first.length - 1].date)}</span>`;
      wrap.appendChild(scale);
    }
  }

  function wireLedgerTooltips(container) {
    let tipEl = document.getElementById("floatingLedgerTip");
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.id = "floatingLedgerTip";
      tipEl.className = "ledger-tip-float";
      document.body.appendChild(tipEl);
    }
    if (!container._ledgerTipBound) {
      container._ledgerTipBound = true;
      container.addEventListener("mouseover", e => {
        const cell = e.target.closest(".ledger-cell");
        if (!cell) { tipEl.style.display = "none"; return; }
        tipEl.textContent = cell.getAttribute("data-tip") || "";
        tipEl.style.display = "block";
        positionLedgerTip(tipEl, cell);
      });
      container.addEventListener("mouseout", e => {
        if (e.target.closest(".ledger-cell")) tipEl.style.display = "none";
      });
      container.addEventListener("mousemove", e => {
        if (tipEl.style.display === "block") {
          positionLedgerTip(tipEl, e.target.closest(".ledger-cell"));
        }
      });
    }
  }

  function positionLedgerTip(tipEl, cell) {
    if (!cell) return;
    const rect = cell.getBoundingClientRect();
    tipEl.style.left = (rect.left + rect.width / 2) + "px";
    tipEl.style.top = (rect.top - 12) + "px";
    tipEl.style.transform = "translate(-50%, -100%)";
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
    const escapeCsv = value => `"${String(value).replace(/"/g, '""')}"`;
    const csvContent = [headers, ...rows].map(row => row.map(escapeCsv).join(",")).join("\n");
    const encodedUri = URL.createObjectURL(new Blob([csvContent], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CharterSense_SAIL_Optimization_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(encodedUri);
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
        badge.className = "connection-status connected";
        statusText.textContent = "FastAPI ML Server Active";
        loadBackendKPIs();
      } else {
        badge.className = "connection-status standalone";
        statusText.textContent = "Analytics service unavailable";
      }
    } catch {
      badge.className = "connection-status standalone";
      statusText.textContent = "Analytics service unavailable";
    }
  }

  async function loadBackendKPIs() {
    try {
      const res = await fetch("/api/dashboard/kpi");
      if (res.ok) {
        const kpi = await res.json();
        const savEl = document.getElementById("kpiSavings");
        const accEl = document.getElementById("kpiAccuracy");
        if (savEl) savEl.textContent = kpi.total_savings == null ? "—" : `${kpi.total_savings}%`;
        if (accEl) accEl.textContent = kpi.avg_forecast_accuracy == null ? "—" : `${kpi.avg_forecast_accuracy}%`;
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
  async function run() {
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

      const response = await fetch("/api/charter/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route: routeForCargo(cargo), port, cargo_size: tonnage,
          laycan_start: fmtDate(laycanStart), laycan_end: fmtDate(laycanEnd)
        })
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || "Optimization request failed.");
      }
      const result = await response.json();
      const { plan, perClassForecast } = dashboardDataFromApi(result);

      try { renderRouteMap(port); } catch (e) { console.error("RouteMap err:", e); }

      if (!plan || plan.length === 0) {
        throw new Error("The server returned an outdated optimization response. Stop the server, run 'python main.py' from the SIH folder, then refresh this page with Ctrl+F5.");
      }

      const best = plan[0];
      const bestKey = `${fmtDate(best.date)}|${best.vessel}`;

      try { renderRecommendation(best, port); } catch (e) { console.error("Rec err:", e); }
      try { renderChart(perClassForecast); } catch (e) { console.error("Chart err:", e); }
      try { renderLedger(plan, bestKey); } catch (e) { console.error("Ledger err:", e); }
      try { renderTable(plan, bestKey); } catch (e) { console.error("Table err:", e); }
    } catch (err) {
      console.error("Critical run error:", err);
      alert(err.message || "The optimization service is unavailable. Start the FastAPI server and retry.");
    }
  }

  function routeForCargo(cargo) {
    return cargo === "Iron Ore" ? "Australia-East Coast India" : "Australia-East Coast India";
  }

  function dashboardDataFromApi(result) {
    const perClassForecast = {};
    Object.entries(result.forecasts || {}).forEach(([vessel, forecast]) => {
      perClassForecast[vessel] = {
        history: (forecast.history_dates || []).map((value, index) => ({ date: parseDate(value), rate: forecast.history_values[index] })),
        forecast: (forecast.dates || []).map((value, index) => ({ date: parseDate(value), rate: forecast.values[index] })),
        mae: 0,
        r2: 0
      };
    });
    const legacyOptions = (result.options && result.options.length)
      ? result.options
      : (result.recommended_vessel ? [{
          vessel_class: result.recommended_vessel,
          capacity: VESSEL_CLASSES[result.recommended_vessel]?.dwt || 0,
          charter_window: result.charter_window,
          base_freight: result.estimated_cost,
          demurrage_cost: 0,
          total_cost: result.estimated_cost,
        }] : []);
    const apiPlan = Array.isArray(result.plan) && result.plan.length
      ? result.plan
      : legacyOptions.map(option => ({
          date: option.charter_window?.optimal_date,
          vessel_class: option.vessel_class,
          capacity: option.capacity,
          rate: option.charter_window?.optimal_rate,
          base_freight: option.base_freight,
          late_cost: 0,
          demurrage_cost: option.demurrage_cost,
          total_cost: option.total_cost,
        }));
    const plan = apiPlan.map(item => ({
      date: parseDate(item.date), vessel: item.vessel_class,
      dwt: item.capacity, rate: item.rate,
      baseFreight: item.base_freight, lateCost: item.late_cost, demurrageCost: item.demurrage_cost,
      totalCost: item.total_cost, mae: 0, r2: 0,
      requestedLaycan: `${result.requested_laycan?.start || ""} → ${result.requested_laycan?.end || ""}`
    }));
    return { plan, perClassForecast };
  }

  window.addEventListener("DOMContentLoaded", () => {
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

    [startEl, endEl].forEach(dateInput => {
      if (dateInput) {
        dateInput.addEventListener("change", () => {
          if (startEl?.value && endEl?.value && parseDate(endEl.value) > parseDate(startEl.value)) {
            run();
          }
        });
      }
    });

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
    document.querySelectorAll(".btn-scenario").forEach(btn => {
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
      // Chart.js (responsive: true) resizes the live chart on its own. Only the
      // manual fallback canvas needs a redraw, and only when data is already loaded.
      if (cachedForecastData && typeof Chart !== "undefined") return;
      if (cachedForecastData) {
        const ctx = document.getElementById("forecastChart");
        if (ctx) drawFallbackCanvasChart(ctx, cachedForecastData);
      }
    });

    startLiveClock();
    checkBackendStatus();
    run();
  });
})();
