const TOKEN_KEY = "nzeru.token";
const API_BASE_KEY = "nzeru.apiBase";

function isNative() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

function defaultApiBase() {
  return isNative() ? "http://10.0.2.2:4000" : "";
}

function apiBase() {
  if (!isNative()) return "";
  return (localStorage.getItem(API_BASE_KEY) || defaultApiBase()).replace(/\/$/, "");
}

function setApiBase(url) {
  const cleaned = String(url || "")
    .trim()
    .replace(/\/$/, "");
  if (cleaned) localStorage.setItem(API_BASE_KEY, cleaned);
  else localStorage.removeItem(API_BASE_KEY);
}

function applyNativeShell() {
  if (!isNative()) return;
  document.documentElement.classList.add("native");
  const input = document.getElementById("apiBaseInput");
  if (input) input.value = apiBase();
}

const authView = document.getElementById("authView");
const farmView = document.getElementById("farmView");
const serverPill = document.getElementById("serverPill");

let token = localStorage.getItem(TOKEN_KEY) || "";
let status = null;
let districts = [];
let chatLang = "en";
let advisor = { soils: [], nutrients: [], copy: {} };
let chatReady = false;
let farmPlan = null;
let planDraft = { crops: [], readiness: {} };
let farmPlot = null;
let planTab = "budget";

const CHAT_UI = {
  en: {
    title: "Ask in English, Chichewa, or Tumbuka",
    disclaimer:
      "This assistant gives simplified demo advice. Confirm chemical products and rates with your extension officer before use. Photo diagnosis is not live yet.",
    weather: "Today's weather",
    market: "What's my crop worth?",
    crop: "Best crop for my soil",
    pest: "My plant looks sick",
    soil: "Soil type",
    nutrient: "Nutrient status",
    ask: "Ask a farming question",
    placeholder: "e.g. holes in the leaves, yellow streaks, or what fertiliser to use",
    send: "Send",
    recommend: "Recommend a crop",
    pestPrompt: "holes in the leaves and worms on the maize",
  },
  ny: {
    title: "Funsani mu Chingerezi, Chichewa, kapena Chitumbuka",
    disclaimer:
      "Wothandizirayu akupereka malangizo osavuta a chitsanzo. Onetsetsani ndi wa Ulimi musanagwiritse ntchito mankhwala. Chithunzi sichikuwunikidwa pano.",
    weather: "Nyengo lero",
    market: "Mitengo ya msika",
    crop: "Mbewu yabwino pa nthaka yanga",
    pest: "Mbewu yanga ikudwala",
    soil: "Mtundu wa nthaka",
    nutrient: "Zakudya za nthaka",
    ask: "Funsani za ulimi",
    placeholder: "mwachitsanzo: mabowo pa masamba, mawanga achikasu, kapena feteleza",
    send: "Tumizani",
    recommend: "Langizani mbewu",
    pestPrompt: "mphutsi pa masamba ndi mabowo",
  },
  tum: {
    title: "Fumbani mu Chizungu, Chichewa, panji Chitumbuka",
    disclaimer:
      "Wovwira uyu wakupeleka ulongozgi wapadera wa chiyelezgero. Fumbani wa vilimo pambere mundagwiliskire ntchito mankhwala. Chithuzithuzi chikulutila yayi pano.",
    weather: "Nyengo yasono",
    market: "Mitengo ya msika",
    crop: "Mbeu yiwemi pa charu chane",
    pest: "Mbeu yane yikulwala",
    soil: "Mtundu wa charu",
    nutrient: "Vyakulya vya charu",
    ask: "Fumbani za ulimi",
    placeholder: "mwachiyelezgero: viwaya pa masamba, vibiriwiri, panji feteleza",
    send: "Tumizgani",
    recommend: "Longozgani mbeu",
    pestPrompt: "mphutsi pa masamba na viwaya",
  },
};

function showError(id, message) {
  const el = document.getElementById(id);
  el.hidden = !message;
  el.textContent = message || "";
}

// Toast notification system
function showToast(message, type = "info", duration = 5000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  const titles = {
    success: "Success",
    error: "Error",
    warning: "Warning",
    info: "Info",
  };

  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${titles[type] || titles.info}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" aria-label="Close">&times;</button>
    ${duration > 0 ? '<div class="toast-progress"></div>' : ""}
  `;

  const closeBtn = toast.querySelector(".toast-close");
  const removeToast = () => {
    toast.classList.add("toast-exit");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 250);
  };

  closeBtn.addEventListener("click", removeToast);

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(removeToast, duration);
  }

  return toast;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMoney(n) {
  return `MWK ${Number(n || 0).toLocaleString("en")}`;
}

function addWire(_method, _path, _requestBody, _responseBody, _httpStatus) {
  // Traffic logging lives on /ussd-sim for developer testing.
}

async function api(method, path, { body, auth = false, plain = false } = {}) {
  const headers = {};
  if (body != null) headers["Content-Type"] = "application/json";
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiBase() + path, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const raw = await res.text();
  let parsed = raw;
  if (!plain) {
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = { error: raw };
    }
  }
  addWire(method, path, body ?? null, parsed, res.status);
  if (!res.ok) {
    const message = (parsed && parsed.error) || raw || res.statusText;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return parsed;
}

async function checkServer() {
  try {
    const health = await api("GET", "/health");
    serverPill.textContent = health.ok ? "Server connected" : "Server issue";
    serverPill.className = "server-pill " + (health.ok ? "ok" : "bad");
  } catch {
    serverPill.textContent = "Server offline";
    serverPill.className = "server-pill bad";
  }
}

function renderAuthTabs(which) {
  document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.authTab === which);
  });
  document.getElementById("loginForm").hidden = which !== "login";
  document.getElementById("registerForm").hidden = which !== "register";
}

function fillDistricts() {
  const districtEl = document.getElementById("regDistrict");
  districtEl.innerHTML = districts.map((d) => `<option value="${d.name}">${d.name}</option>`).join("");
  fillEpas();
}

function fillEpas() {
  const districtName = document.getElementById("regDistrict").value;
  const district = districts.find((d) => d.name === districtName);
  const epaEl = document.getElementById("regEpa");
  const epas = district?.epas || [];
  epaEl.innerHTML = epas.map((epa) => `<option value="${epa}">${epa}</option>`).join("");
}

function renderStepper() {
  const stages = status?.farmer ? window.__stages || [] : [];
  const current = status?.currentStage?.index ?? -1;
  document.getElementById("stepper").innerHTML = stages
    .map((stage) => {
      const cls = stage.index < current ? "done" : stage.index === current ? "current" : "";
      return `<li class="${cls}"><span class="dot"></span>${stage.name}</li>`;
    })
    .join("");
}

function renderFarm() {
  if (!status?.farmer) {
    authView.hidden = false;
    farmView.hidden = true;
    return;
  }
  authView.hidden = true;
  farmView.hidden = false;
  const farmer = status.farmer;
  document.getElementById("farmerCode").textContent = farmer.code;
  document.getElementById("farmerName").textContent = farmer.name;
  document.getElementById("farmerPlace").textContent = [farmer.district, farmer.epa, farmer.region]
    .filter(Boolean)
    .join(" · ");
  renderPassport(status.passport);
  document.getElementById("currentStage").textContent = status.currentStage?.name || "Not started";
  document.getElementById("nextStage").textContent = status.nextStage?.name || "Season complete";
  const btn = document.getElementById("advanceBtn");
  btn.disabled = status.seasonComplete;
  btn.textContent = status.seasonComplete ? "Season complete" : `Log ${status.nextStage.name} from this app`;
  renderStepper();
  const events = status.events || [];
  document.getElementById("eventLog").innerHTML = events.length
    ? events
        .map(
          (event) => `
        <div class="event-row">
          <div>
            <strong>${event.stageName}</strong>
            <div class="hint">${fmtTime(event.createdAt)}</div>
          </div>
          <span class="channel ${event.channel}">${event.channel}</span>
        </div>`
        )
        .join("")
    : `<p class="hint">No stages logged yet. Use the button above or dial *413#.</p>`;
  const receipts = status.receipts || [];
  const receiptCard = document.getElementById("receiptCard");
  receiptCard.hidden = receipts.length === 0;
  document.getElementById("receiptList").innerHTML = receipts
    .map(
      (row) => `
    <div class="ledger-row">
      <div>
        <strong>${row.code}</strong>
        <div class="hint">${row.crop} · ${row.weightKg} kg · ${row.moisturePct}% · ${fmtTime(row.createdAt)}</div>
      </div>
      <div class="ledger-side">
        <span class="badge ${row.loanPending ? "loan_pending" : row.status}">${row.loanPending ? "Loan waiting" : row.statusLabel}</span>
        <div class="hint">${row.loanDisbursed ? `Loan ${fmtMoney(row.loanDisbursed)} sent` : row.loanPending ? `Advance ${fmtMoney(row.loanCap)}` : "No loan"}</div>
        ${row.loanPending ? `<button type="button" class="primary" data-accept-loan="${row.id}" style="margin-top:8px;">Accept ${fmtMoney(row.loanCap)}</button>` : ""}
      </div>
    </div>`
    )
    .join("");
  document.querySelectorAll("[data-accept-loan]").forEach((btn) => {
    btn.addEventListener("click", () => acceptLoan(btn.dataset.acceptLoan));
  });
  loadWeather(farmer.district);
  fillChatSelects();
  if (!chatReady) {
    renderChatGreeting();
    chatReady = true;
  }
  loadPlan();
  loadPlot();
  loadMarket();
  loadVouchers();
  loadInputsCatalog();
  loadFarmerProfile();
}

async function loadStatus() {
  status = await api("GET", "/api/farmers/me/status", { auth: true });
  renderFarm();
}

function renderPassport(passport) {
  if (!passport) return;
  document.getElementById("passportId").textContent = `Farmer Passport · ${passport.code}`;
  document.getElementById("passportPlace").textContent = [passport.district, passport.epa, passport.phone]
    .filter(Boolean)
    .join(" · ");
  document.getElementById("passportGrade").textContent = passport.grade;
  document.getElementById("passportLabel").textContent = passport.label;
  document.getElementById("passportIncome").textContent = fmtMoney(passport.netIncome);
  document.getElementById("passportScore").textContent = passport.stagesLogged ? String(passport.score) : "—";
  document.getElementById("passportLoan").textContent = passport.loanPending
    ? `${fmtMoney(passport.loanPending)} waiting`
    : fmtMoney(passport.loanDisbursed);
  document.getElementById("passportStatus").textContent = passport.status;
  document.getElementById("passportChecks").innerHTML = (passport.checks || [])
    .map(
      (row) => `
    <div class="passport-check">
      <span class="mark">${row.done ? "✓" : "·"}</span>
      <span>${row.label}</span>
    </div>`
    )
    .join("");
}

async function acceptLoan(receiptId) {
  showError("advanceError", "");
  try {
    const payload = await api("POST", "/api/farmers/me/loans", { auth: true, body: { receiptId } });
    status = payload.farmer;
    renderFarm();
  } catch (error) {
    showError("advanceError", error.message);
  }
}

async function loadWeather(district) {
  const note = document.getElementById("wxNote");
  try {
    const wx = await api("GET", `/api/weather?district=${encodeURIComponent(district)}`);
    document.getElementById("weatherTitle").textContent = wx.district;
    const pill = document.getElementById("weatherAlert");
    pill.textContent = (wx.alert || "—").toUpperCase();
    pill.className = "alert-pill " + wx.alert;
    document.getElementById("wxNow").textContent = wx.nowC + "°C";
    document.getElementById("wxHumidity").textContent = wx.humidity + "%";
    document.getElementById("wxRain3").textContent = wx.rain3dayMm + " mm";
    document.getElementById("wxWind").textContent = wx.windKmh + " km/h";
    document.getElementById("wxForecast").innerHTML = (wx.forecast || [])
      .map(
        (day) => `
      <div class="wx-day">
        <div class="wx-lbl">${day.day}</div>
        <div class="wx-val">${Math.round(day.max)}°/${Math.round(day.min)}°</div>
        <div class="hint">${Number(day.rain || 0).toFixed(0)}mm</div>
      </div>`
      )
      .join("");
    document.getElementById("wxSeason").textContent = `${wx.season.label} — ${wx.season.text}`;
    document.getElementById("wxField").textContent = wx.fieldAdvice;
    note.textContent = `Live from Open-Meteo · ${wx.district}`;
  } catch (error) {
    note.textContent = error.message || "Could not load weather.";
  }
}

async function loadMarketCompare(commoditySlug, district) {
  const summary = document.getElementById("marketCompareSummary");
  const table = document.getElementById("marketCompareTable");
  const sourcePanel = document.getElementById("marketSourceCompare");
  const opportunitiesPanel = document.getElementById("marketOpportunities");
  if (!summary || !commoditySlug) return;

  summary.textContent = "Loading comparison…";
  table.innerHTML = "";
  sourcePanel.innerHTML = "";
  opportunitiesPanel.innerHTML = "";

  try {
    const compare = await api("GET", `/api/market/compare?commodity=${encodeURIComponent(commoditySlug)}`);
    if (compare.stats) {
      summary.textContent = `${compare.commodity}: lowest ${compare.stats.lowestBuyLabel} (${compare.stats.lowestDistrict}) · highest ${compare.stats.highestBuyLabel} (${compare.stats.highestDistrict}) · spread ${compare.stats.spread.toLocaleString("en")} MWK/kg`;
    } else {
      summary.textContent = `No district comparison yet for ${compare.commodity}.`;
    }
    table.innerHTML =
      (compare.districts || [])
        .map(
          (row) => `
      <div class="kv-row${row.buyPricePerKg === compare.stats?.lowestBuy ? " price-low" : row.buyPricePerKg === compare.stats?.highestBuy ? " price-high" : ""}">
        <span>${row.district} · ${row.source}${row.priceKind === "procurement" ? " · gov" : ""}</span>
        <strong>${row.buyPrice || "—"}${row.sellPrice ? ` / ${row.sellPrice}` : ""}</strong>
      </div>`
        )
        .join("") || `<p class="hint">Need warehouse quotes in at least two hubs.</p>`;

    if (district) {
      const sources = await api(
        "GET",
        `/api/market/sources/compare?commodity=${encodeURIComponent(commoditySlug)}&district=${encodeURIComponent(district)}`
      );
      sourcePanel.innerHTML = `<p class="eyebrow">Sources in ${district}</p>${
        (sources.sources || [])
          .map(
            (row) => `
        <div class="kv-row${row.buyPricePerKg === sources.stats?.lowestBuy ? " price-low" : row.buyPricePerKg === sources.stats?.highestBuy ? " price-high" : ""}">
          <span>${row.source}${row.priceKind === "procurement" ? " · procurement" : ""}</span>
          <strong>${row.buyPrice || "—"}</strong>
        </div>`
          )
          .join("") || `<p class="hint">No source quotes for your district yet.</p>`
      }`;
    }

    const opps = await api("GET", `/api/market/opportunities?commodity=${encodeURIComponent(commoditySlug)}`);
    opportunitiesPanel.innerHTML = `<p class="eyebrow">Profitable haulage (after transport)</p>${
      (opps.opportunities || [])
        .slice(0, 4)
        .map(
          (row) => `
      <div class="kv-row">
        <span>${row.commodity}: ${row.fromDistrict} → ${row.toDistrict}${row.profitable ? "" : " · not profitable"}</span>
        <strong>${row.netMarginLabel || row.spreadLabel}${row.transportPerKg ? ` · haul ${row.transportLabel}` : ""}</strong>
      </div>
      <p class="hint">${row.note}</p>`
        )
        .join("") ||
      `<p class="hint">No cross-hub opportunities yet. Need live prices in at least two warehouse hubs.</p>`
    }`;
    const transportNote = document.getElementById("marketTransportNote");
    if (transportNote) {
      transportNote.textContent = opps.profitableCount
        ? `${opps.profitableCount} profitable route${opps.profitableCount === 1 ? "" : "s"} after transport. Gross spread shown before haulage is still in the district compare above.`
        : "Cross-hub spreads exist but none stay profitable after configured haulage costs.";
    }
  } catch (error) {
    summary.textContent = error.message || "Could not load comparison.";
  }
}

const TREND_COLORS = ["#2d6a4f", "#bc6c25", "#1d3557", "#9b2226", "#6a4c93", "#457b9d"];
let marketTrendChartInstance = null;

function renderMarketTrendChart(payload, canvasId = "marketTrendChart") {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return;
  if (marketTrendChartInstance) {
    marketTrendChartInstance.destroy();
    marketTrendChartInstance = null;
  }
  if (!payload?.series?.length) return;

  const labels = payload.labels || [];
  marketTrendChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: payload.series.map((row, index) => ({
        label: row.source,
        data: labels.map((date) => row.points.find((point) => point.date === date)?.buyPricePerKg ?? null),
        borderColor: TREND_COLORS[index % TREND_COLORS.length],
        backgroundColor: "transparent",
        tension: 0.25,
        spanGaps: true,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: { title: { display: true, text: "MWK / kg (buy)" } },
      },
    },
  });
}

async function loadMarketTrends(commoditySlug, district, range) {
  const summary = document.getElementById("marketTrendSummary");
  if (!summary || !commoditySlug) return;
  summary.textContent = "Loading trend chart…";
  try {
    const qs = new URLSearchParams({ commodity: commoditySlug, range: range || "30d" });
    if (district) qs.set("district", district);
    const payload = await api("GET", `/api/market/trends?${qs}`);
    if (payload.stats) {
      const change = payload.stats.change >= 0 ? `+${payload.stats.change}` : payload.stats.change;
      summary.textContent =
        `${payload.commodity} · ${payload.rangeLabel}${district ? ` · ${district}` : ""} · ` +
        `${payload.stats.count} observations · last buy MWK ${payload.stats.lastBuy?.toLocaleString("en")}/kg ` +
        `(${change} MWK${payload.stats.changePct != null ? `, ${payload.stats.changePct}%` : ""})`;
    } else {
      summary.textContent = `No trend data yet for ${payload.commodity}. Refresh feeds or import historical prices.`;
    }
    renderMarketTrendChart(payload);
  } catch (error) {
    summary.textContent = error.message || "Could not load trends.";
    if (marketTrendChartInstance) {
      marketTrendChartInstance.destroy();
      marketTrendChartInstance = null;
    }
  }
}

async function downloadMarketCsv({ commodity, district, range }) {
  const qs = new URLSearchParams();
  if (commodity) qs.set("commodity", commodity);
  if (district) qs.set("district", district);
  if (range) qs.set("range", range);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${apiBase()}/api/market/export?${qs}`, { headers });
  if (!res.ok) throw new Error("Could not download CSV export");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "market-prices.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function loadMarketHistory(commoditySlug, district) {
  const panel = document.getElementById("marketHistoryPanel");
  const list = document.getElementById("marketHistoryList");
  const title = document.getElementById("marketHistoryTitle");
  if (!panel || !commoditySlug) {
    if (panel) panel.hidden = true;
    return;
  }
  panel.hidden = false;
  title.textContent = `${commoditySlug.replace(/-/g, " ")} · last 30 days`;
  list.innerHTML = `<p class="hint">Loading history…</p>`;
  try {
    const qs = new URLSearchParams({ commodity: commoditySlug, days: "30" });
    if (district) qs.set("district", district);
    const payload = await api("GET", `/api/market/history?${qs}`);
    list.innerHTML =
      (payload.points || [])
        .slice(-20)
        .reverse()
        .map(
          (row) => `
      <div class="kv-row">
        <span>${new Date(row.fetchedAt).toLocaleDateString()} · ${row.source} · ${row.market}</span>
        <strong>${row.buyPrice || "—"}${row.sellPrice ? ` / ${row.sellPrice}` : ""}</strong>
      </div>`
        )
        .join("") ||
      `<p class="hint">No history yet for this commodity. Prices are stored each time feeds refresh.</p>`;
  } catch (error) {
    list.innerHTML = `<p class="hint">${error.message || "Could not load history."}</p>`;
  }
  const trendRange = document.getElementById("marketTrendRange")?.value || "30d";
  const trendSelect = document.getElementById("marketTrendCommodity");
  if (trendSelect) trendSelect.value = commoditySlug;
  await loadMarketTrends(commoditySlug, district, trendRange);
}

async function loadMarketAlerts() {
  const panel = document.getElementById("marketAlertsPanel");
  if (!panel || !token) {
    if (panel) panel.hidden = true;
    return;
  }
  panel.hidden = false;
  try {
    const payload = await api("GET", "/api/market/alerts", { auth: true });
    const commoditySelect = document.getElementById("marketAlertCommodity");
    if (commoditySelect && commoditySelect.options.length <= 1) {
      const compareSelect = document.getElementById("marketCompareCommodity");
      commoditySelect.innerHTML = compareSelect?.innerHTML || `<option value="maize">Maize</option>`;
    }
    document.getElementById("marketAlertsSummary").textContent =
      `${payload.activeCount || 0} active alert${payload.activeCount === 1 ? "" : "s"} · checked after each market refresh.`;
    document.getElementById("marketAlertsList").innerHTML =
      (payload.alerts || [])
        .map(
          (row) => `
      <div class="ledger-row">
        <div>
          <strong>${row.commoditySlug} · ${row.direction} ${row.thresholdLabel || row.thresholdPerKg}</strong>
          <div class="meta">${row.district}${row.locationSlug ? ` · ${row.locationSlug}` : ""}</div>
        </div>
        <button type="button" class="ghost" data-alert-id="${row.id}">Remove</button>
      </div>`
        )
        .join("") || `<p class="hint">No alerts yet.</p>`;
    document
      .getElementById("marketAlertsList")
      .querySelectorAll("[data-alert-id]")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          await api("DELETE", `/api/market/alerts/${btn.dataset.alertId}`, { auth: true });
          await loadMarketAlerts();
        });
      });
    document.getElementById("marketAlertEvents").innerHTML =
      (payload.events || [])
        .map(
          (row) => `
      <div class="ledger-row">
        <div>
          <strong>${row.message}</strong>
          <div class="meta">${new Date(row.triggeredAt).toLocaleString("en-MW")}</div>
        </div>
      </div>`
        )
        .join("") || `<p class="hint">No triggered alerts yet.</p>`;
  } catch (error) {
    document.getElementById("marketAlertsSummary").textContent = error.message;
  }
}

async function loadMarketLocations(district) {
  const select = document.getElementById("marketLocationFilter");
  if (!select) return;
  try {
    const qs = district ? `?district=${encodeURIComponent(district)}` : "";
    const payload = await api("GET", `/api/market/locations${qs}`, token ? { auth: true } : undefined);
    const current = select.value;
    select.innerHTML = `<option value="">All locations</option>${(payload.tradingCentres || [])
      .map((row) => `<option value="${row.slug}">${row.name} · ${row.district}</option>`)
      .join("")}`;
    if ([...select.options].some((opt) => opt.value === current)) select.value = current;
  } catch {
    /* keep existing options */
  }
}

async function loadMarket(options = {}) {
  const district = status?.farmer?.district;
  const commodityFilter = document.getElementById("marketCommodityFilter");
  const locationFilter = document.getElementById("marketLocationFilter");
  const commodity = commodityFilter?.value || "";
  const locationSlug = locationFilter?.value || "";
  await loadMarketLocations(district);
  try {
    const qs = new URLSearchParams();
    if (district) qs.set("district", district);
    if (commodity) qs.set("commodity", commodity);
    if (locationSlug) qs.set("location", locationSlug);
    if (options.refresh) qs.set("refresh", "1");
    const payload = await api("GET", `/api/market/prices?${qs}`);
    const prices = payload.prices || [];

    if (commodityFilter && commodityFilter.options.length <= 1) {
      commodityFilter.innerHTML = `<option value="">All commodities</option>${(payload.commodities || [])
        .map((row) => `<option value="${row.slug}">${row.name}</option>`)
        .join("")}`;
      const compareSelect = document.getElementById("marketCompareCommodity");
      if (compareSelect && compareSelect.options.length <= 1) {
        compareSelect.innerHTML = (payload.commodities || [])
          .map((row) => `<option value="${row.slug}">${row.name}</option>`)
          .join("");
      }
      const trendSelect = document.getElementById("marketTrendCommodity");
      if (trendSelect && trendSelect.options.length <= 1) {
        trendSelect.innerHTML = (payload.commodities || [])
          .map((row) => `<option value="${row.slug}">${row.name}</option>`)
          .join("");
      }
    }

    const buyValues = prices.map((row) => row.buyPricePerKg).filter((value) => value != null);
    const minBuy = buyValues.length ? Math.min(...buyValues) : null;
    const maxBuy = buyValues.length ? Math.max(...buyValues) : null;

    const scope = document.getElementById("marketScopeNote");
    if (scope) {
      scope.textContent = district
        ? `Showing prices relevant to ${district}${payload.stats?.count ? ` · ${payload.stats.count} live quote${payload.stats.count === 1 ? "" : "s"}` : ""}.`
        : "Log in to filter prices for your district.";
    }

    const tbody = document.getElementById("marketPriceBody");
    if (tbody) {
      tbody.innerHTML =
        prices
          .map(
            (row) => `
        <tr data-slug="${row.commoditySlug || ""}">
          <td><strong>${row.crop}</strong>${row.priceKind === "procurement" ? ' <span class="hint procurement">gov</span>' : row.priceKind === "reference" ? ' <span class="hint procurement">ref</span>' : ""}</td>
          <td>${row.market}${row.district ? `<div class="hint">${row.district}</div>` : ""}</td>
          <td class="${row.buyPricePerKg === minBuy ? "price-low" : row.buyPricePerKg === maxBuy ? "price-high" : ""}">${row.buyPrice || "—"}</td>
          <td>${row.sellPrice || "—"}</td>
          <td>${row.source}</td>
          <td>${row.updatedLabel || "—"}</td>
        </tr>`
          )
          .join("") ||
        `<tr><td colspan="6"><p class="hint">No prices yet. The server refreshes LocalBuyEx and Ulimi automatically.</p></td></tr>`;
      tbody.querySelectorAll("tr[data-slug]").forEach((tr) => {
        tr.addEventListener("click", () => loadMarketHistory(tr.dataset.slug, district));
      });
    }

    document.getElementById("marketTable").innerHTML =
      prices
        .filter((r) => r.sourceSlug === "localbuy")
        .map(
          (row) => `
      <div class="market-row">
        <div>
          <strong>${row.crop}</strong>
          <div class="hint">${row.buyPrice || "—"}${row.market ? ` · ${row.market}` : ""}</div>
        </div>
        <div class="trend flat">${row.source}<div class="hint">${row.updatedLabel || ""}</div></div>
      </div>`
        )
        .join("") || `<p class="hint">No warehouse quotes for your nearest hub yet.</p>`;

    const note = document.getElementById("marketNote");
    if (note) {
      const sources = (payload.sources || [])
        .map((s) => `${s.name} (${s.status === "ok" ? s.updatedLabel : s.status})`)
        .join(" · ");
      note.textContent = sources
        ? `Sources: ${sources}. Tap a row for 30-day history. Lowest/highest buy prices are highlighted. Ministry floor prices below still govern off-take contracts.`
        : "Market prices are stored in PostgreSQL each time feeds refresh.";
    }

    const compareCommodity = document.getElementById("marketCompareCommodity")?.value || commodity || "maize";
    await loadMarketCompare(compareCommodity, district);

    const trendCommodity = document.getElementById("marketTrendCommodity")?.value || compareCommodity;
    const trendRange = document.getElementById("marketTrendRange")?.value || "30d";
    await loadMarketTrends(trendCommodity, district, trendRange);
    if (token) await loadMarketAlerts();
  } catch {
    document.getElementById("marketPriceBody").innerHTML =
      `<tr><td colspan="6"><p class="hint">Market figures unavailable.</p></td></tr>`;
    document.getElementById("marketTable").innerHTML = `<p class="hint">Market figures unavailable.</p>`;
  }
  try {
    const floors = await api("GET", "/api/floors");
    document.getElementById("floorTable").innerHTML = (floors.floors || [])
      .map(
        (row) => `
      <div class="kv-row">
        <span>${row.crop} floor</span>
        <strong>MWK ${Number(row.pricePerKg).toLocaleString("en")}/kg</strong>
      </div>`
      )
      .join("");
  } catch {
    document.getElementById("floorTable").innerHTML = "";
  }
}

async function loadVouchers() {
  const note = document.getElementById("vouchersNote");
  const list = document.getElementById("vouchersList");
  
  if (!status?.farmer) {
    note.textContent = "Sign in to view your input vouchers.";
    list.innerHTML = "";
    return;
  }

  try {
    note.textContent = "Loading vouchers…";
    const payload = await api("GET", "/api/farmers/me/vouchers", { auth: true });
    const vouchers = payload.vouchers || [];

    if (vouchers.length === 0) {
      note.textContent = "You have no input vouchers yet. Contact your extension officer for FISP allocation.";
      list.innerHTML = "";
      return;
    }

    note.textContent = `You have ${vouchers.length} voucher${vouchers.length === 1 ? "" : "s"}.`;

    list.innerHTML = vouchers
      .map((v) => {
        const statusClass = v.status === "active" ? "accepted" : v.status === "redeemed" ? "loan_disbursed" : "rejected";
        const statusText = v.status === "active" ? "ACTIVE — Ready to redeem" : v.status === "redeemed" ? "REDEEMED" : v.status.toUpperCase();
        
        const inputList = v.inputs
          .map((inp) => `<div class="hint">• ${inp.inputName}: ${inp.quantity} ${inp.inputUnit}</div>`)
          .join("");

        const expiryDate = new Date(v.expiresAt);
        const isExpiringSoon = v.status === "active" && (expiryDate - Date.now()) < 30 * 24 * 60 * 60 * 1000;

        return `
          <div class="ledger-row">
            <div>
              <strong>${v.code}</strong>
              <div class="hint">Season ${v.season} · ${v.inputs.length} input${v.inputs.length === 1 ? "" : "s"}</div>
              ${inputList}
              ${v.summary.totalFarmerContribution > 0 ? `<div class="hint" style="margin-top:4px;">Your contribution: MWK ${v.summary.totalFarmerContribution.toLocaleString("en")}</div>` : `<div class="hint" style="margin-top:4px;">Fully subsidized (${Math.round(v.summary.subsidyPercentage)}% govt support)</div>`}
              ${isExpiringSoon ? `<div class="hint" style="color:#d97706;margin-top:4px;">⚠ Expires ${fmtTime(v.expiresAt)}</div>` : ""}
            </div>
            <div class="ledger-side">
              <span class="badge ${statusClass}">${statusText}</span>
              <div class="hint">${fmtTime(v.issuedAt)}</div>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (error) {
    note.textContent = `Failed to load vouchers: ${error.message}`;
    list.innerHTML = "";
  }
}

async function loadFarmerProfile() {
  if (!status?.farmer) return;

  try {
    // Load farmer's full profile from database
    const profileData = await api("GET", "/api/farmers/me", { auth: true });
    const farmer = profileData.farmer;

    // Populate form fields with existing data
    if (document.getElementById("profileGender")) document.getElementById("profileGender").value = farmer.gender || "";
    if (document.getElementById("profileDob") && farmer.dateOfBirth) {
      const date = new Date(farmer.dateOfBirth);
      document.getElementById("profileDob").value = date.toISOString().split("T")[0];
    }
    if (document.getElementById("profileNationalId")) document.getElementById("profileNationalId").value = farmer.nationalId || "";
    if (document.getElementById("profileVillage")) document.getElementById("profileVillage").value = farmer.village || "";
    if (document.getElementById("profileMaritalStatus")) document.getElementById("profileMaritalStatus").value = farmer.maritalStatus || "";
    if (document.getElementById("profileHouseholdSize")) document.getElementById("profileHouseholdSize").value = farmer.householdSize || "";
    if (document.getElementById("profileEducation")) document.getElementById("profileEducation").value = farmer.educationLevel || "";
    if (document.getElementById("profileExperience")) document.getElementById("profileExperience").value = farmer.yearsOfExperience || "";
    if (document.getElementById("profileAltPhone")) document.getElementById("profileAltPhone").value = farmer.alternativePhone || "";
    if (document.getElementById("profileEmail")) document.getElementById("profileEmail").value = farmer.email || "";
  } catch (error) {
    console.error("Failed to load farmer profile:", error);
  }
}

async function saveProfile(formData) {
  try {
    await api("PUT", "/api/farmers/me", {
      auth: true,
      body: formData,
    });
    
    showToast("Your profile has been updated successfully!", "success");
    
    // Reload status to refresh farmer info
    await loadStatus();
  } catch (error) {
    showToast(error.message || "Failed to update profile", "error");
  }
}

let currentInputCategory = "all";

async function loadInputsCatalog(category = "all") {
  const note = document.getElementById("inputsNote");
  const list = document.getElementById("inputsList");
  currentInputCategory = category;

  try {
    note.textContent = "Loading inputs…";
    const params = category !== "all" ? `?category=${category}` : "";
    const payload = await api("GET", `/api/inputs${params}`, { auth: false });
    const inputs = payload.inputs || [];

    if (inputs.length === 0) {
      note.textContent = category !== "all" ? `No ${category} inputs available.` : "No inputs available.";
      list.innerHTML = "";
      return;
    }

    note.textContent = `${inputs.length} input${inputs.length === 1 ? "" : "s"} available${category !== "all" ? ` in ${category}` : ""}.`;

    list.innerHTML = inputs
      .map((inp) => {
        const categoryBadge = inp.category === "fertilizer" ? "accepted" : inp.category === "seed" ? "loan_disbursed" : "pending";
        
        return `
          <div class="ledger-row">
            <div>
              <strong>${inp.name}</strong>
              <div class="hint">${inp.description || "No description"}</div>
              ${inp.supplier ? `<div class="hint" style="margin-top:4px;">Supplier: ${inp.supplier}</div>` : ""}
            </div>
            <div class="ledger-side">
              <span class="badge ${categoryBadge}">${inp.category.toUpperCase()}</span>
              <div class="stat">MWK ${inp.standardPrice.toLocaleString("en")}/${inp.unit}</div>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (error) {
    note.textContent = `Failed to load inputs: ${error.message}`;
    list.innerHTML = "";
  }
}

function setSession(payload) {
  token = payload.token;
  localStorage.setItem(TOKEN_KEY, token);
}

function logout() {
  token = "";
  status = null;
  chatReady = false;
  localStorage.removeItem(TOKEN_KEY);
  renderFarm();
  authView.hidden = false;
  farmView.hidden = true;
}

document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
  btn.addEventListener("click", () => renderAuthTabs(btn.dataset.authTab));
});

document.querySelectorAll("[data-demo]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.getElementById("loginPhone").value = btn.dataset.demo;
    document.getElementById("loginPin").value = "1234";
    renderAuthTabs("login");
    showError("loginError", "");
    try {
      const payload = await api("POST", "/api/farmers/login", {
        body: { phone: btn.dataset.demo, pin: "1234" },
      });
      setSession(payload);
      await loadStatus();
    } catch (error) {
      showError("loginError", error.message);
    }
  });
});

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("loginError", "");
  try {
    const payload = await api("POST", "/api/farmers/login", {
      body: {
        phone: document.getElementById("loginPhone").value,
        pin: document.getElementById("loginPin").value,
      },
    });
    setSession(payload);
    showToast(`Welcome back, ${payload.farmer.name}!`, "success");
    await loadStatus();
  } catch (error) {
    showError("loginError", error.message);
    showToast(error.message || "Login failed", "error");
  }
});

document.getElementById("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("registerError", "");
  try {
    const payload = await api("POST", "/api/farmers/register", {
      body: {
        name: document.getElementById("regName").value,
        phone: document.getElementById("regPhone").value,
        pin: document.getElementById("regPin").value,
        district: document.getElementById("regDistrict").value,
        epa: document.getElementById("regEpa").value,
      },
    });
    setSession(payload);
    showToast(`Welcome to Nzeru za Alimi, ${payload.farmer.name}! Your account has been created.`, "success");
    await loadStatus();
  } catch (error) {
    showError("registerError", error.message);
    showToast(error.message || "Registration failed", "error");
  }
});

document.getElementById("regDistrict").addEventListener("change", fillEpas);
document.getElementById("logoutBtn").addEventListener("click", logout);

document.getElementById("advanceBtn").addEventListener("click", async () => {
  showError("advanceError", "");
  try {
    status = await api("POST", "/api/farmers/me/events", { auth: true, body: {} });
    showToast(`Milestone logged: ${status.currentStage?.name || "Complete"}!`, "success");
    renderFarm();
  } catch (error) {
    showError("advanceError", error.message);
    showToast(error.message || "Failed to log milestone", "error");
  }
});

document.getElementById("nativeServerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setApiBase(document.getElementById("apiBaseInput").value);
  await checkServer();
});

function fillChatSelects() {
  const soilEl = document.getElementById("chatSoil");
  const nutrientEl = document.getElementById("chatNutrient");
  if (!soilEl || !advisor.soils.length) return;
  const farmer = status?.farmer;
  soilEl.innerHTML = advisor.soils.map((s) => `<option value="${s}">${s}</option>`).join("");
  nutrientEl.innerHTML = advisor.nutrients.map((s) => `<option value="${s}">${s}</option>`).join("");
  if (farmer?.soilType) soilEl.value = farmer.soilType;
  if (farmer?.nutrientStatus) nutrientEl.value = farmer.nutrientStatus;
}

function applyChatLang() {
  const ui = CHAT_UI[chatLang] || CHAT_UI.en;
  const copy = advisor.copy?.[chatLang];
  document.getElementById("chatTitle").textContent = ui.title;
  document.getElementById("chatDisclaimer").textContent = copy?.disclaimer || ui.disclaimer;
  document.querySelector('[data-chat-topic="weather"]').textContent = ui.weather;
  document.querySelector('[data-chat-topic="market"]').textContent = ui.market;
  document.querySelector('[data-chat-topic="crop"]').textContent = ui.crop;
  document.querySelector('[data-chat-topic="pest"]').textContent = ui.pest;
  document.getElementById("chatSoilLabel").firstChild.textContent = ui.soil + " ";
  document.getElementById("chatNutrientLabel").firstChild.textContent = ui.nutrient + " ";
  document.getElementById("chatAskLabel").firstChild.textContent = ui.ask + " ";
  document.getElementById("chatInput").placeholder = ui.placeholder;
  document.getElementById("chatSend").textContent = ui.send;
  document.getElementById("chatCropBtn").textContent = ui.recommend;
  document.querySelectorAll("[data-chat-lang]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.chatLang === chatLang);
  });
}

function addChatBubble(text, who) {
  const win = document.getElementById("chatWindow");
  if (!win || !text) return;
  const div = document.createElement("div");
  div.className = "chat-bubble " + (who || "bot");
  div.textContent = text;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

function renderChatGreeting() {
  const win = document.getElementById("chatWindow");
  if (!win) return;
  win.innerHTML = "";
  const copy = advisor.copy?.[chatLang];
  addChatBubble(copy?.greeting || CHAT_UI[chatLang].title, "bot");
}

async function loadAdvisor() {
  try {
    advisor = await api("GET", "/api/advisor");
    fillChatSelects();
    applyChatLang();
  } catch {
    advisor = {
      soils: ["Sandy", "Sandy loam", "Loamy", "Clay loam", "Clay"],
      nutrients: ["Low nitrogen", "Low phosphorus", "Low potassium", "Balanced / fertile", "Acidic soil"],
      copy: {},
    };
    fillChatSelects();
    applyChatLang();
  }
}

async function askChat({ text, topic, soil, nutrient, showUser = true }) {
  showError("chatError", "");
  if (showUser && text) addChatBubble(text, "user");
  try {
    const payload = await api("POST", "/api/advisor/ask", {
      auth: true,
      body: {
        text: text || "",
        topic: topic || "auto",
        lang: chatLang,
        soil: soil || document.getElementById("chatSoil").value,
        nutrient: nutrient || document.getElementById("chatNutrient").value,
        channel: "mobile",
      },
    });
    addChatBubble(payload.reply || "No reply.", "bot");
  } catch (error) {
    showError("chatError", error.message);
  }
}

document.querySelectorAll("[data-chat-lang]").forEach((btn) => {
  btn.addEventListener("click", () => {
    chatLang = btn.dataset.chatLang;
    applyChatLang();
    renderChatGreeting();
  });
});

document.querySelectorAll("[data-chat-topic]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const topic = btn.dataset.chatTopic;
    const ui = CHAT_UI[chatLang] || CHAT_UI.en;
    if (topic === "pest") {
      document.getElementById("chatInput").value = ui.pestPrompt;
      await askChat({ text: ui.pestPrompt, topic: "pest" });
      return;
    }
    if (topic === "crop") {
      await askChat({
        text: ui.crop,
        topic: "crop",
        soil: document.getElementById("chatSoil").value,
        nutrient: document.getElementById("chatNutrient").value,
      });
      return;
    }
    await askChat({ text: btn.textContent, topic });
  });
});

document.getElementById("chatCropBtn").addEventListener("click", async () => {
  const ui = CHAT_UI[chatLang] || CHAT_UI.en;
  await askChat({
    text: ui.crop,
    topic: "crop",
    soil: document.getElementById("chatSoil").value,
    nutrient: document.getElementById("chatNutrient").value,
  });
});

document.getElementById("chatForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = document.getElementById("chatInput").value.trim();
  if (!text) {
    showError("chatError", "Type a question, or tap Recommend a crop.");
    return;
  }
  document.getElementById("chatInput").value = "";
  await askChat({ text, topic: "auto" });
});

function renderPlotPolygon(svgEl, polygon) {
  if (!svgEl || !polygon?.length) return;
  const lats = polygon.map((point) => point.lat);
  const lons = polygon.map((point) => point.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const pad = 8;
  const width = 200 - pad * 2;
  const height = 120 - pad * 2;
  const points = polygon
    .map((point) => {
      const x = pad + ((point.lon - minLon) / (maxLon - minLon || 1)) * width;
      const y = pad + ((maxLat - point.lat) / (maxLat - minLat || 1)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  svgEl.innerHTML = `<polygon points="${points}" fill="rgba(214,154,34,0.15)" stroke="#D69A22" stroke-width="1.6" stroke-dasharray="4 3"/>`;
}

function renderPlotMap(mapEl, embedUrl) {
  if (!mapEl) return;
  mapEl.innerHTML = embedUrl
    ? `<iframe title="OpenStreetMap plot" src="${embedUrl}" loading="lazy" referrerpolicy="no-referrer"></iframe>`
    : `<p class="hint">Map unavailable offline.</p>`;
}

function renderPlot(payload) {
  if (!payload?.plot) return;
  farmPlot = payload;
  const plot = payload.plot;
  document.getElementById("plotNote").textContent = payload.note || "";
  document.getElementById("plotCoords").textContent = payload.coordsLabel || "—";
  document.getElementById("plotArea").textContent = `${plot.hectares} ha`;
  document.getElementById("plotNdvi").textContent = `${plot.ndvi.toFixed(2)} · ${plot.ndviLabel}`;
  const badge = document.getElementById("plotBadge");
  badge.textContent = plot.verified ? "GPS verified" : "EPA estimate";
  badge.className = `badge ${plot.verified ? "accepted" : "routine"}`;
  renderPlotMap(document.getElementById("plotMap"), payload.map?.embedUrl);
  renderPlotPolygon(document.getElementById("plotPolygon"), plot.polygon);
  const openLink = document.getElementById("plotOpenMap");
  if (payload.map?.openUrl) {
    openLink.href = payload.map.openUrl;
    openLink.hidden = false;
  } else {
    openLink.hidden = true;
  }
}

async function loadPlot() {
  showError("plotError", "");
  try {
    const payload = await api("GET", "/api/farmers/me/plot", { auth: true });
    renderPlot(payload);
  } catch (error) {
    document.getElementById("plotNote").textContent = error.message;
  }
}

async function saveGpsPlot() {
  showError("plotError", "");
  const btn = document.getElementById("plotGpsBtn");
  if (!navigator.geolocation) {
    showError("plotError", "GPS is not available in this browser.");
    return;
  }
  btn.disabled = true;
  btn.textContent = "Getting location…";
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const payload = await api("PUT", "/api/farmers/me/plot", {
          auth: true,
          body: {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracyM: pos.coords.accuracy,
            source: "gps",
          },
        });
        renderPlot(payload);
      } catch (error) {
        showError("plotError", error.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "Use my location";
      }
    },
    (err) => {
      showError("plotError", err.message || "Could not read GPS.");
      btn.disabled = false;
      btn.textContent = "Use my location";
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

document.getElementById("plotGpsBtn").addEventListener("click", saveGpsPlot);

async function loadPlan() {
  try {
    farmPlan = await api("GET", "/api/farmers/me/plan", { auth: true });
    planDraft = {
      crops: farmPlan.crops.map((row) => ({
        crop: row.crop,
        hectares: row.hectares,
        startMonth: row.startMonth,
      })),
      readiness: { ...farmPlan.readiness },
    };
    renderPlan();
  } catch (error) {
    document.getElementById("planIntro").textContent = error.message;
  }
}

function collectPlanDraft() {
  const rows = [...document.querySelectorAll(".plan-crop-row")].map((row) => ({
    crop: row.querySelector("[data-plan-crop]").value,
    hectares: Number(row.querySelector("[data-plan-ha]").value) || 1,
    startMonth: row.querySelector("[data-plan-month]").value,
  }));
  const readiness = {
    waterSource: document.getElementById("planWaterSource").value,
    experience: document.getElementById("planExperience").value,
    storage: document.querySelector('[data-plan-toggle="storage"]').classList.contains("on"),
    equipment: document.querySelector('[data-plan-toggle="equipment"]').classList.contains("on"),
    agritex: document.querySelector('[data-plan-toggle="agritex"]').classList.contains("on"),
  };
  return { crops: rows, readiness };
}

function renderPlanCropRows() {
  const options = (farmPlan?.cropOptions || ["Maize"])
    .map((crop) => `<option value="${crop}">${crop}</option>`)
    .join("");
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1);
    const label = new Date(2026, i, 1).toLocaleString("en", { month: "short" });
    return `<option value="${m}">${label}</option>`;
  }).join("");
  document.getElementById("planCropRows").innerHTML = planDraft.crops
    .map(
      (row, index) => `
    <div class="plan-crop-row">
      <label>Crop
        <select data-plan-crop data-index="${index}">${options}</select>
      </label>
      <label>Hectares
        <input data-plan-ha data-index="${index}" inputmode="decimal" value="${row.hectares}">
      </label>
      <label>Start month
        <select data-plan-month data-index="${index}">${monthOptions}</select>
      </label>
      <button type="button" data-plan-remove="${index}" aria-label="Remove crop">✕</button>
    </div>`
    )
    .join("");
  planDraft.crops.forEach((row, index) => {
    document.querySelector(`[data-plan-crop][data-index="${index}"]`).value = row.crop;
    document.querySelector(`[data-plan-month][data-index="${index}"]`).value = row.startMonth;
  });
  document.querySelectorAll("[data-plan-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      planDraft.crops.splice(Number(btn.dataset.planRemove), 1);
      if (!planDraft.crops.length)
        planDraft.crops.push({ crop: "Maize", hectares: 1, startMonth: String(new Date().getMonth() + 1) });
      renderPlanCropRows();
    });
  });
}

function applyReadinessToForm() {
  const r = planDraft.readiness || {};
  if (r.waterSource) document.getElementById("planWaterSource").value = r.waterSource;
  if (r.experience) document.getElementById("planExperience").value = r.experience;
  ["storage", "equipment", "agritex"].forEach((key) => {
    document.querySelector(`[data-plan-toggle="${key}"]`).classList.toggle("on", !!r[key]);
  });
}

function renderPlan() {
  if (!farmPlan) return;
  applyReadinessToForm();
  renderPlanCropRows();
  const bank = farmPlan.bankability;
  const border = bank.score >= 70 ? "var(--green)" : bank.score >= 40 ? "var(--gold-deep)" : "var(--alert)";
  document.getElementById("planBankability").innerHTML = `
    <div class="plan-bank-top">
      <div class="plan-bank-score" style="border-color:${border}">
        <strong>${bank.score}</strong><span>/100</span>
      </div>
      <div>
        <strong>${bank.status}</strong>
        <p class="hint">Grade ${bank.grade} · saved ${farmPlan.updatedAt ? fmtTime(farmPlan.updatedAt) : "just now"}</p>
      </div>
    </div>`;
  document.getElementById("planWeatherNote").textContent = farmPlan.weatherNote || "";
  const c = farmPlan.combined;
  document.getElementById("planSummary").innerHTML = `
    <div class="plan-metric"><div class="lbl">Total area</div><div class="val">${c.hectares.toFixed(1)} ha</div></div>
    <div class="plan-metric"><div class="lbl">Total cost</div><div class="val">${fmtMoney(c.totalCost)}</div></div>
    <div class="plan-metric"><div class="lbl">Revenue</div><div class="val">${fmtMoney(c.totalRevenue)}</div></div>
    <div class="plan-metric"><div class="lbl">Net margin</div><div class="val">${fmtMoney(c.totalMargin)}</div></div>`;

  const primary = farmPlan.crops[0]?.budget;
  document.getElementById("planTabBudget").innerHTML = farmPlan.crops
    .map(
      (row) => `
    <div class="market-row" style="flex-direction:column;align-items:stretch;gap:6px;">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <strong>${row.crop} · ${row.hectares} ha</strong>
        <span class="badge ${row.planting.status === "ontime" ? "accepted" : row.planting.status === "early" ? "routine" : "drying_required"}">${row.planting.label}</span>
      </div>
      <div class="hint">${row.cropInfo?.reason || "Crop fit notes from your soil record."}</div>
      <div class="hint">Price ${fmtMoney(row.budget.priceMwkKg)}/kg${row.budget.marketPrice ? " · live market" : ""}${row.budget.belowFloor ? " · below ministry floor" : ""}</div>
      ${row.budget.costBreakdown
        .map(
          (part) => `
        <div class="plan-costbar">
          <span style="width:72px;color:var(--ink-soft);">${part.label}</span>
          <span class="plan-costbar-track"><span class="plan-costbar-fill" style="width:${Math.round((part.amount / row.budget.totalCost) * 100)}%;"></span></span>
          <span class="mono">${fmtMoney(part.amount)}</span>
        </div>`
        )
        .join("")}
    </div>`
    )
    .join("");

  document.getElementById("planTabDaily").innerHTML = (farmPlan.tabs.dailyPlan || [])
    .map(
      (row) => `
    <div class="daily-plan-row ${row.tone || ""}">
      <span class="daily-plan-day">${row.day}</span>
      <div><strong>${row.title}</strong><div class="hint">${row.desc}</div></div>
    </div>`
    )
    .join("");

  let running = 0;
  document.getElementById("planTabCashflow").innerHTML = `
    <table class="market-row" style="display:block;padding:0;background:transparent;">
      ${(farmPlan.tabs.cashflow || [])
        .map((row) => {
          running += row.amount;
          return `<div class="market-row"><span>${row.label}</span><strong>${fmtMoney(row.amount)} · running ${fmtMoney(running)}</strong></div>`;
        })
        .join("")}
    </table>`;

  document.getElementById("planTabDecisions").innerHTML = (farmPlan.decisions || [])
    .map(
      (row) => `
    <div class="plan-decision"><span>${row.icon}</span><div><strong>${row.title}</strong><div class="hint">${row.detail}</div></div></div>`
    )
    .join("");

  document.querySelectorAll("[data-plan-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.planTab === planTab);
  });
  ["budget", "daily", "cashflow", "decisions"].forEach((name) => {
    document.getElementById(`planTab${name.charAt(0).toUpperCase()}${name.slice(1)}`).hidden = planTab !== name;
  });
}

document.getElementById("planAddCrop").addEventListener("click", () => {
  planDraft.crops.push({ crop: "Groundnuts", hectares: 0.5, startMonth: String(new Date().getMonth() + 1) });
  renderPlanCropRows();
});

document.getElementById("planSuggestCrop").addEventListener("click", () => {
  const pick = farmPlan?.suggestedCrops?.[0];
  if (!pick) return;
  planDraft.crops.unshift({ crop: pick.crop, hectares: 1, startMonth: String(new Date().getMonth() + 1) });
  renderPlanCropRows();
});

document.querySelectorAll("[data-plan-toggle]").forEach((btn) => {
  btn.addEventListener("click", () => btn.classList.toggle("on"));
});

document.querySelectorAll("[data-plan-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    planTab = btn.dataset.planTab;
    renderPlan();
  });
});

document.getElementById("planSaveBtn").addEventListener("click", async () => {
  showError("planError", "");
  try {
    farmPlan = await api("PUT", "/api/farmers/me/plan", {
      auth: true,
      body: collectPlanDraft(),
    });
    planDraft = {
      crops: farmPlan.crops.map((row) => ({ crop: row.crop, hectares: row.hectares, startMonth: row.startMonth })),
      readiness: { ...farmPlan.readiness },
    };
    showToast("Your farm plan has been saved successfully!", "success");
    renderPlan();
  } catch (error) {
    showError("planError", error.message);
    showToast(error.message || "Failed to save farm plan", "error");
  }
});

async function boot() {
  applyNativeShell();
  await checkServer();
  const stagePayload = await api("GET", "/api/stages");
  window.__stages = stagePayload.stages || [];
  const districtPayload = await api("GET", "/api/districts");
  districts = districtPayload.districts || [];
  fillDistricts();
  // Don't load market prices until user logs in (district filtering requires authentication)
  // loadMarket() will be called in renderFarm() after login
  document.getElementById("marketCommodityFilter")?.addEventListener("change", () => loadMarket());
  document.getElementById("marketLocationFilter")?.addEventListener("change", () => loadMarket());
  document.getElementById("marketRefreshBtn")?.addEventListener("click", () => loadMarket({ refresh: true }));
  document.getElementById("marketAlertForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById("marketAlertError");
    errorEl.hidden = true;
    try {
      await api("POST", "/api/market/alerts", {
        auth: true,
        body: {
          commoditySlug: document.getElementById("marketAlertCommodity")?.value || "maize",
          direction: document.getElementById("marketAlertDirection")?.value || "above",
          thresholdPerKg: Number(document.getElementById("marketAlertThreshold")?.value),
          district: status?.farmer?.district,
        },
      });
      document.getElementById("marketAlertThreshold").value = "";
      await loadMarketAlerts();
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.hidden = false;
    }
  });
  document.getElementById("marketCompareBtn")?.addEventListener("click", () => {
    const slug = document.getElementById("marketCompareCommodity")?.value || "maize";
    loadMarketCompare(slug, status?.farmer?.district);
  });
  document.getElementById("marketCompareCommodity")?.addEventListener("change", () => {
    const slug = document.getElementById("marketCompareCommodity")?.value || "maize";
    loadMarketCompare(slug, status?.farmer?.district);
  });
  document.getElementById("marketTrendBtn")?.addEventListener("click", () => {
    const slug = document.getElementById("marketTrendCommodity")?.value || "maize";
    const range = document.getElementById("marketTrendRange")?.value || "30d";
    loadMarketTrends(slug, status?.farmer?.district, range);
  });
  document.getElementById("marketTrendRange")?.addEventListener("change", () => {
    const slug = document.getElementById("marketTrendCommodity")?.value || "maize";
    const range = document.getElementById("marketTrendRange")?.value || "30d";
    loadMarketTrends(slug, status?.farmer?.district, range);
  });
  document.getElementById("marketExportBtn")?.addEventListener("click", async () => {
    try {
      await downloadMarketCsv({
        commodity: document.getElementById("marketTrendCommodity")?.value || "maize",
        district: status?.farmer?.district,
        range: document.getElementById("marketTrendRange")?.value || "30d",
      });
    } catch (error) {
      alert(error.message || "Export failed");
    }
  });

  // Input catalog category tabs
  document.querySelectorAll("[data-input-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-input-category]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadInputsCatalog(btn.dataset.inputCategory);
    });
  });

  // Profile form submit
  document.getElementById("profileForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = {
      gender: document.getElementById("profileGender")?.value || null,
      dateOfBirth: document.getElementById("profileDob")?.value || null,
      nationalId: document.getElementById("profileNationalId")?.value || null,
      village: document.getElementById("profileVillage")?.value || null,
      maritalStatus: document.getElementById("profileMaritalStatus")?.value || null,
      householdSize: document.getElementById("profileHouseholdSize")?.value || null,
      educationLevel: document.getElementById("profileEducation")?.value || null,
      yearsOfExperience: document.getElementById("profileExperience")?.value || null,
      alternativePhone: document.getElementById("profileAltPhone")?.value || null,
      email: document.getElementById("profileEmail")?.value || null,
    };
    await saveProfile(formData);
  });

  // Household and assets management (placeholders for now)
  document.getElementById("addHouseholdBtn")?.addEventListener("click", () => {
    alert("Household member management coming soon! Please contact your extension officer to update household information.");
  });

  document.getElementById("addAssetBtn")?.addEventListener("click", () => {
    alert("Asset tracking coming soon! Please contact your extension officer to register your assets and livestock.");
  });

  await loadAdvisor();
  if (token) {
    try {
      await loadStatus();
    } catch {
      logout();
    }
  }
}

boot();
