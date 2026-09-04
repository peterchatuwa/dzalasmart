const TOKEN_KEY = "nzeru.staffToken";

const authView = document.getElementById("authView");
const deskView = document.getElementById("deskView");
const wireLog = document.getElementById("wireLog");
const serverPill = document.getElementById("serverPill");

let token = localStorage.getItem(TOKEN_KEY) || "";
let staff = null;
let summaries = [];
let stages = [];
let selectedId = null;
let warehouse = { receipts: [] };
let crops = [];
let monitor = { floors: [], contracts: [] };
let districts = [];

function showError(id, message) {
  const el = document.getElementById(id);
  el.hidden = !message;
  el.textContent = message || "";
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

function addWire(method, path, requestBody, responseBody, httpStatus) {
  const item = document.createElement("article");
  item.className = "wire-item";
  const req = requestBody == null ? "(empty)" : JSON.stringify(requestBody, null, 2);
  const res = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody, null, 2);
  item.innerHTML = `
    <header>
      <span>${method} ${path}</span>
      <span>${httpStatus}</span>
    </header>
    <pre>→ ${req}\n\n← ${res}</pre>`;
  wireLog.prepend(item);
}

async function api(method, path, { body, auth = false } = {}) {
  const headers = {};
  if (body != null) headers["Content-Type"] = "application/json";
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const raw = await res.text();
  let parsed = {};
  try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = { error: raw }; }
  addWire(method, path, body ?? null, parsed, res.status);
  if (!res.ok) {
    const error = new Error(parsed.error || raw || res.statusText);
    error.status = res.status;
    throw error;
  }
  return parsed;
}

function roleLabel(role) {
  if (role === "extension") return "Extension officer";
  if (role === "cooperative") return "Cooperative manager";
  if (role === "ministry") return "Ministry official";
  if (role === "fum") return "Farmers Union director";
  return role;
}

function renderList() {
  const district = document.getElementById("districtFilter").value;
  const rows = summaries.filter((row) => !district || row.farmer.district === district);
  document.getElementById("farmerList").innerHTML = rows.map((row) => {
    const stage = row.currentStage?.name || "Not started";
    const active = row.farmer.id === selectedId ? " active" : "";
    return `
      <button type="button" class="farmer-card${active}" data-id="${row.farmer.id}">
        <div class="name">${row.farmer.name}</div>
        <div class="meta">${row.farmer.code} · ${row.farmer.district}${row.farmer.epa ? " · " + row.farmer.epa : ""}</div>
        <div class="meta">${stage} · ${row.eventCount} event${row.eventCount === 1 ? "" : "s"}</div>
      </button>`;
  }).join("") || `<p class="hint">No farmers in this district.</p>`;

  document.querySelectorAll(".farmer-card").forEach((btn) => {
    btn.addEventListener("click", () => openFarmer(btn.dataset.id));
  });
}

function fillDistrictFilter() {
  const select = document.getElementById("districtFilter");
  const current = select.value;
  const districts = [...new Set(summaries.map((row) => row.farmer.district))].sort();
  select.innerHTML = `<option value="">All districts</option>` +
    districts.map((name) => `<option value="${name}">${name}</option>`).join("");
  if (districts.includes(current)) select.value = current;
}

async function openFarmer(id) {
  selectedId = id;
  renderList();
  const detail = await api("GET", `/api/staff/farmers/${id}`, { auth: true });
  document.getElementById("emptyDetail").hidden = true;
  document.getElementById("farmerDetail").hidden = false;
  const farmer = detail.farmer;
  document.getElementById("detailCode").textContent = farmer.code;
  document.getElementById("detailName").textContent = farmer.name;
  document.getElementById("detailPlace").textContent = [farmer.district, farmer.epa, farmer.region].filter(Boolean).join(" · ");
  const passport = detail.passport;
  const passEl = document.getElementById("detailPassport");
  passEl.hidden = !passport;
  if (passport) {
    document.getElementById("detailPassportGrade").textContent = passport.grade;
    document.getElementById("detailPassportScore").textContent = passport.stagesLogged ? `Score ${passport.score}` : "Unrated";
    document.getElementById("detailPassportLabel").textContent = passport.label;
    document.getElementById("detailPassportIncome").textContent = fmtMoney(passport.netIncome);
    document.getElementById("detailPassportLoan").textContent = passport.loanPending
      ? `${fmtMoney(passport.loanPending)} waiting`
      : fmtMoney(passport.loanDisbursed);
  }
  document.getElementById("detailCurrent").textContent = detail.currentStage?.name || "Not started";
  document.getElementById("detailNext").textContent = detail.nextStage?.name || "Season complete";
  const current = detail.currentStage?.index ?? -1;
  document.getElementById("detailStepper").innerHTML = stages.map((stage) => {
    const cls = stage.index < current ? "done" : stage.index === current ? "current" : "";
    return `<li class="${cls}"><span class="dot"></span>${stage.name}</li>`;
  }).join("");
  document.getElementById("detailEvents").innerHTML = detail.events.length
    ? detail.events.map((event) => `
        <div class="event-row">
          <div>
            <strong>${event.stageName}</strong>
            <div class="hint">${fmtTime(event.createdAt)}</div>
          </div>
          <span class="channel ${event.channel}">${event.channel}</span>
        </div>`).join("")
    : `<p class="hint">No stages logged yet.</p>`;
  const receipts = detail.receipts || [];
  document.getElementById("detailReceiptsTitle").hidden = receipts.length === 0;
  document.getElementById("detailReceipts").innerHTML = receipts.map((row) => `
    <div class="ledger-row">
      <div>
        <strong>${row.code}</strong>
        <div class="meta">${row.crop} · ${row.weightKg} kg · ${row.moisturePct}%</div>
      </div>
      <span class="badge ${row.status}">${row.statusLabel}</span>
    </div>`).join("");
  renderIntakeForm(detail);
  renderStaffPlot(detail.plot);
}

function renderStaffPlot(payload) {
  const el = document.getElementById("detailPlot");
  if (!payload?.plot) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const plot = payload.plot;
  document.getElementById("detailPlotCoords").textContent = payload.coordsLabel || "—";
  document.getElementById("detailPlotArea").textContent = `${plot.hectares} ha`;
  document.getElementById("detailPlotNdvi").textContent = `${plot.ndvi.toFixed(2)} · ${plot.ndviLabel}`;
  const badge = document.getElementById("detailPlotBadge");
  badge.textContent = plot.verified ? "GPS verified" : "EPA estimate";
  badge.className = `badge ${plot.verified ? "accepted" : "routine"}`;
  const mapEl = document.getElementById("detailPlotMap");
  mapEl.innerHTML = payload.map?.embedUrl
    ? `<iframe title="Farmer plot map" src="${payload.map.embedUrl}" loading="lazy" referrerpolicy="no-referrer"></iframe>`
    : `<p class="hint">No map link.</p>`;
}

function harvestReady(detail) {
  return (detail.currentStage?.index ?? -1) >= 4;
}

function renderIntakeForm(detail) {
  const form = document.getElementById("intakeForm");
  const banner = document.getElementById("detailBanner");
  const coop = staff?.role === "cooperative";
  banner.textContent = coop
    ? "Cooperative desk — accepted grain writes Post-Harvest Handling. A cleared sale writes Marketing."
    : staff?.role === "fum"
      ? "FUM desk — you watch live contracts. You cannot change floors or take in grain."
      : staff?.role === "ministry"
        ? "Ministry desk — you set national floor prices. Contracts below the floor are blocked automatically."
        : "Read only — stages are logged by the farmer app, *413#, the warehouse, or a cleared sale.";
  banner.classList.toggle("coop", coop);
  form.hidden = !(coop && harvestReady(detail));
  showError("intakeError", "");
  if (form.hidden) return;
  if (!harvestReady(detail)) {
    showError("intakeError", "This farmer has not reached Harvest yet.");
  }
}

function showDesk() {
  authView.hidden = true;
  deskView.hidden = false;
  document.getElementById("staffRole").textContent = roleLabel(staff.role);
  document.getElementById("staffName").textContent = staff.name;
  document.getElementById("staffOrg").textContent = [staff.org, staff.district, staff.epa].filter(Boolean).join(" · ");
  const notes = {
    cooperative: "Cooperative managers grade grain, record buyer offers, and can advance Post-Harvest and Marketing.",
    ministry: "The ministry sets national floor prices and reads the NDVI crop-health map across every EPA.",
    fum: "FUM watches live off-take contracts and the national NDVI map. Offers below the ministry floor are already blocked.",
    extension: "Extension officers see a visit queue for their EPA — pest reports, stalled seasons, and harvests still waiting at the warehouse.",
  };
  document.getElementById("staffTopbarNote").textContent = notes[staff.role] || notes.extension;
  const nationalRoles = new Set(["ministry", "fum", "extension"]);
  document.getElementById("nationalPanel").hidden = !nationalRoles.has(staff.role);
}

function logout() {
  token = "";
  staff = null;
  summaries = [];
  selectedId = null;
  localStorage.removeItem(TOKEN_KEY);
  authView.hidden = false;
  deskView.hidden = true;
}

async function loadDesk() {
  const me = await api("GET", "/api/staff/me", { auth: true });
  staff = me.staff;
  const list = await api("GET", "/api/staff/farmers", { auth: true });
  summaries = list.farmers || [];
  showDesk();
  fillDistrictFilter();
  renderList();
  await loadWarehouse();
  await loadMonitor();
  await loadPests();
  await loadVisits();
  await loadNational();
  await loadMarketAdmin();
  loadAlerts();
}

async function loadMarketAdmin() {
  const panel = document.getElementById("marketAdminPanel");
  const form = document.getElementById("marketManualForm");
  if (!panel) return;
  const canEdit = staff?.role === "ministry" || staff?.role === "cooperative";
  if (form) form.hidden = !canEdit;
  try {
    const payload = await api("GET", "/api/staff/market/sources", { auth: true });
    document.getElementById("marketSourceList").innerHTML = (payload.sources || []).map((row) => `
      <div class="ledger-row">
        <div>
          <strong>${row.name}</strong>
          <div class="meta">${row.kind}${row.url ? ` · ${row.url}` : ""}</div>
          ${row.lastError ? `<div class="meta">${row.lastError}</div>` : ""}
        </div>
        <span class="badge ${row.status === "ok" ? "accepted" : row.status === "error" ? "rejected" : "drying_required"}">${row.status} · ${row.updatedLabel}</span>
      </div>`).join("") || `<p class="hint">No market sources configured yet.</p>`;
  } catch (error) {
    document.getElementById("marketSourceList").innerHTML = `<p class="hint">${error.message}</p>`;
  }
  const districtSelect = document.getElementById("marketManualDistrict");
  if (districtSelect && districtSelect.options.length <= 1) {
    districtSelect.innerHTML = districts.map((name) => `<option value="${name}">${name}</option>`).join("");
  }
}

function fillCrops() {
  const select = document.getElementById("intakeCrop");
  select.innerHTML = crops.map((row) =>
    `<option value="${row.crop}">${row.crop} · MWK ${row.pricePerKg}/kg · accept ≤ ${row.acceptAt}%</option>`
  ).join("");
}

function renderWarehouse() {
  const receipts = warehouse.receipts || [];
  const avg = warehouse.avgMoisture == null ? "—" : `${warehouse.avgMoisture}%`;
  document.getElementById("warehouseStats").innerHTML = `
    <div>
      <p class="eyebrow">Stored today</p>
      <p class="stat">${warehouse.storedKg || 0} kg</p>
    </div>
    <div>
      <p class="eyebrow">Avg moisture</p>
      <p class="stat">${avg}</p>
    </div>
    <div>
      <p class="eyebrow">Accepted / drying / rejected</p>
      <p class="stat">${warehouse.acceptedLots || 0} / ${warehouse.dryingLots || 0} / ${warehouse.rejectedLots || 0}</p>
    </div>`;
  const latest = warehouse.latest;
  let loanLine = "Not yet triggered";
  if (latest?.loanPending) loanLine = `${fmtMoney(latest.loanCap)} offered on ${latest.code} — waiting on the farmer`;
  else if (latest && latest.status === "accepted") loanLine = `${fmtMoney(latest.loanDisbursed)} disbursed on ${latest.code}`;
  document.getElementById("intakeLedger").innerHTML = (receipts.length
    ? receipts.map((row) => `
        <div class="ledger-row">
          <div>
            <strong>${row.farmerName}</strong>
            <div class="meta">${row.farmerCode} · ${row.crop} · ${row.weightKg} kg · ${row.moisturePct}%</div>
          </div>
          <div class="ledger-side">
            <span class="badge ${row.status}">${row.statusLabel}</span>
            <div class="meta">${row.loanPending ? `${fmtMoney(row.loanCap)} waiting` : row.status === "accepted" ? fmtMoney(row.loanDisbursed) : "No loan"}</div>
          </div>
        </div>`).join("")
    : `<p class="hint">No lots taken in yet. Select a farmer who has reached Harvest, then grade a moisture reading.</p>`)
    + `<div class="loan-engine">
        <p class="eyebrow">Moisture-linked microloan</p>
        <p class="hint">Latest intake asset value: ${latest ? fmtMoney(latest.assetValue) : "—"}. Loan cap is 60% of graded value.</p>
        <p class="stat" style="font-size:16px;">${loanLine}</p>
      </div>`;
}

async function loadWarehouse() {
  try {
    warehouse = await api("GET", "/api/staff/warehouse", { auth: true });
    renderWarehouse();
  } catch (error) {
    document.getElementById("intakeLedger").innerHTML = `<p class="hint">${error.message}</p>`;
  }
}

function renderPests(reports) {
  const list = document.getElementById("pestList");
  if (!reports.length) {
    list.innerHTML = `<p class="hint">No pest reports yet. Farmers send them from the assistant or *413# option 4.</p>`;
    return;
  }
  list.innerHTML = reports.map((row) => `
    <div class="ledger-row">
      <div>
        <strong>${row.farmerName}</strong>
        <div class="meta">${row.farmerCode} · ${row.district} · ${row.epa || "—"} · ${row.channel} · ${fmtTime(row.createdAt)}</div>
        <div class="meta">${row.symptoms}</div>
      </div>
      <span class="badge ${row.matchName ? "accepted" : "drying_required"}">${row.matchName || "Unmatched"}</span>
    </div>`).join("");
}

async function loadPests() {
  try {
    const payload = await api("GET", "/api/staff/pests", { auth: true });
    renderPests(payload.reports || []);
  } catch (error) {
    document.getElementById("pestList").innerHTML = `<p class="hint">${error.message}</p>`;
  }
}

function renderVisits(payload) {
  const stats = payload.stats || {};
  document.getElementById("visitHint").textContent = staff?.role === "extension"
    ? `Visit list for ${payload.area || "your EPA"}. Pest reports, stalled seasons, and harvests still at the farm.`
    : "National visit list. Extension officers only see their own EPA.";
  document.getElementById("visitStats").innerHTML = `
    <div>
      <p class="eyebrow">Flagged</p>
      <p class="stat">${stats.flagged || 0}</p>
    </div>
    <div>
      <p class="eyebrow">High priority</p>
      <p class="stat">${stats.high || 0}</p>
    </div>
    <div>
      <p class="eyebrow">Open pest reports</p>
      <p class="stat">${stats.openPestReports || 0}</p>
    </div>
    <div>
      <p class="eyebrow">Reached by USSD this week</p>
      <p class="stat">${stats.ussdFarmersThisWeek || 0}</p>
    </div>`;
  const visits = payload.visits || [];
  const list = document.getElementById("visitList");
  if (!visits.length) {
    list.innerHTML = `<p class="hint">No farmers flagged in this area right now.</p>`;
    return;
  }
  list.innerHTML = visits.map((row) => `
    <button type="button" class="ledger-row visit-row" data-visit-id="${row.farmerId}">
      <div>
        <strong>${row.farmerName}</strong>
        <div class="meta">${row.farmerCode} · ${row.district}${row.epa ? " · " + row.epa : ""}</div>
        <div class="meta">${row.reason}</div>
      </div>
      <span class="badge ${row.priority}">${row.priority === "high" ? "High" : "Routine"}</span>
    </button>`).join("");
  list.querySelectorAll("[data-visit-id]").forEach((btn) => {
    btn.addEventListener("click", () => openFarmer(btn.dataset.visitId));
  });
}

async function loadVisits() {
  try {
    const payload = await api("GET", "/api/staff/visits", { auth: true });
    renderVisits(payload);
  } catch (error) {
    document.getElementById("visitList").innerHTML = `<p class="hint">${error.message}</p>`;
  }
}

function renderNational(payload) {
  const stats = payload.stats || {};
  document.getElementById("nationalHint").textContent = payload.scope === "national"
    ? "Satellite NDVI sampled every five days across every EPA, paired with live pest reports and weather alerts from the register."
    : `District crop-health map for ${payload.scope}. Satellite NDVI is adjusted when farmers in this area report pests.`;
  document.getElementById("nationalStats").innerHTML = `
    <div>
      <p class="eyebrow">EPAs monitored</p>
      <p class="stat">${stats.epasMonitored || 0}</p>
    </div>
    <div>
      <p class="eyebrow">Healthy / watch / alert</p>
      <p class="stat">${stats.healthy || 0} / ${stats.watch || 0} / ${stats.alert || 0}</p>
    </div>
    <div>
      <p class="eyebrow">Farmers on register</p>
      <p class="stat">${stats.farmersRegistered || 0}</p>
    </div>
    <div>
      <p class="eyebrow">GPS plots verified</p>
      <p class="stat">${stats.verifiedGpsPlots || 0}</p>
    </div>
    <div>
      <p class="eyebrow">Maize forecast</p>
      <p class="stat">${stats.productionForecastT || 0} m t</p>
    </div>`;

  const districts = payload.districts || [];
  document.getElementById("nationalMap").innerHTML = districts.map((row) => `
    <div class="epa-cell ${row.status}" title="${row.name}: NDVI ${row.ndvi} · ${row.label}${row.pestReports ? " · " + row.pestReports + " pest report(s)" : ""}">
      <span>${row.name.slice(0, 3).toUpperCase()}</span>
    </div>`).join("");

  const regions = payload.regions || [];
  document.getElementById("nationalRegions").innerHTML = regions.map((row) => `
    <div class="region-card">
      <div class="region-head">
        <strong>${row.name}</strong>
        <span class="badge ${row.risk === "elevated" ? "drying_required" : row.risk === "watch" ? "routine" : "accepted"}">${row.risk}</span>
      </div>
      <p class="meta">${row.epasWithFarmers}/${row.epasTotal} EPAs with farmers · ${row.farmersRegistered} registered</p>
      <div class="meter"><span style="width:${row.registeredPct}%"></span></div>
    </div>`).join("");

  const risks = payload.foodSecurityRisk || [];
  const riskEl = document.getElementById("nationalRisk");
  if (!risks.length) {
    riskEl.innerHTML = `<p class="hint">No districts flagged for food-security risk on this pass.</p>`;
    return;
  }
  riskEl.innerHTML = `
    <p class="eyebrow">Food-security risk</p>` + risks.map((row) => `
    <div class="ledger-row">
      <div>
        <strong>${row.district}</strong>
        <div class="meta">${row.reason}</div>
      </div>
      <span class="badge high">Risk</span>
    </div>`).join("");
}

async function loadNational() {
  const panel = document.getElementById("nationalPanel");
  if (panel.hidden) return;
  try {
    const payload = await api("GET", "/api/staff/national", { auth: true });
    renderNational(payload);
  } catch (error) {
    document.getElementById("nationalMap").innerHTML = `<p class="hint">${error.message}</p>`;
  }
}

function fillSelect(id, values, selected) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = values.map((value) => {
    const label = typeof value === "string" ? value : value.label;
    const v = typeof value === "string" ? value : value.value;
    return `<option value="${v}">${label}</option>`;
  }).join("");
  if (selected) select.value = selected;
}

function renderMonitor() {
  const floors = monitor.floors || [];
  document.getElementById("floorList").innerHTML = floors.map((row) => `
    <div class="kv-row">
      <span>${row.crop} (national floor)</span>
      <strong>${fmtMoney(row.pricePerKg)}/kg</strong>
    </div>`).join("") || `<p class="hint">No floors published yet.</p>`;
  fillSelect("floorCrop", floors.map((row) => row.crop));
  fillSelect("offerCrop", floors.map((row) => row.crop));
  fillSelect("offerDistrict", districts.map((d) => d.name));
  document.getElementById("floorForm").hidden = staff?.role !== "ministry";
  document.getElementById("contractForm").hidden = staff?.role !== "cooperative";
  const violations = monitor.violationCount || 0;
  document.getElementById("contractHint").textContent = violations
    ? `${violations} offer${violations === 1 ? "" : "s"} blocked below the ministry floor.`
    : "Offers below the ministry floor are blocked automatically and cannot pay the farmer.";
  const contracts = monitor.contracts || [];
  document.getElementById("contractList").innerHTML = contracts.length
    ? contracts.map((row) => `
        <div class="ledger-row">
          <div>
            <strong>${row.buyer}</strong>
            <div class="meta">${row.crop} · ${row.district}${row.farmerName ? " · " + row.farmerName : ""}</div>
          </div>
          <div class="ledger-side">
            <span>${fmtMoney(row.pricePerKg)}/kg</span>
            <span class="badge ${row.status}">${row.statusLabel}</span>
          </div>
        </div>`).join("")
    : `<p class="hint">No buyer offers yet.</p>`;
}

async function loadMonitor() {
  try {
    monitor = await api("GET", "/api/staff/contracts", { auth: true });
    renderMonitor();
  } catch (error) {
    document.getElementById("contractList").innerHTML = `<p class="hint">${error.message}</p>`;
  }
}

async function loadAlerts() {
  try {
    const payload = await api("GET", "/api/alerts");
    const districts = payload.districts || [];
    document.getElementById("alertGrid").innerHTML = districts.map((row) => `
      <div class="district-alert ${row.alert || ""}">
        <div class="district-card-top">
          <div>
            <strong>${row.district}</strong>
            <div class="meta">${row.region || ""}</div>
          </div>
          <span class="alert-pill ${row.alert || ""}">${(row.alert || "—").toUpperCase()}</span>
        </div>
        <p class="hint">${row.alertHeadline || ""}</p>
        <p class="hint">${row.fieldAdvice || row.advice || ""}</p>
        ${row.rain3dayMm != null ? `<p class="meta">${row.rain3dayMm}mm rain (3d) · ${row.nowC}°C</p>` : ""}
      </div>`).join("");
  } catch (error) {
    document.getElementById("alertGrid").innerHTML = `<p class="hint">${error.message}</p>`;
  }
}

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("loginError", "");
  try {
    const payload = await api("POST", "/api/staff/login", {
      body: {
        phone: document.getElementById("loginPhone").value,
        pin: document.getElementById("loginPin").value,
      },
    });
    token = payload.token;
    localStorage.setItem(TOKEN_KEY, token);
    await loadDesk();
  } catch (error) {
    showError("loginError", error.message);
  }
});

document.querySelectorAll("[data-demo]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.getElementById("loginPhone").value = btn.dataset.demo;
    document.getElementById("loginPin").value = "1234";
    showError("loginError", "");
    try {
      const payload = await api("POST", "/api/staff/login", {
        body: { phone: btn.dataset.demo, pin: "1234" },
      });
      token = payload.token;
      localStorage.setItem(TOKEN_KEY, token);
      await loadDesk();
    } catch (error) {
      showError("loginError", error.message);
    }
  });
});

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("clearWire").addEventListener("click", () => { wireLog.innerHTML = ""; });
document.getElementById("districtFilter").addEventListener("change", renderList);

document.getElementById("marketManualForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("marketManualError", "");
  try {
    await api("POST", "/api/staff/market/observations", {
      auth: true,
      body: {
        crop: document.getElementById("marketManualCrop").value,
        district: document.getElementById("marketManualDistrict").value,
        buyPricePerKg: Number(document.getElementById("marketManualBuy").value),
        sellPricePerKg: document.getElementById("marketManualSell").value
          ? Number(document.getElementById("marketManualSell").value)
          : undefined,
        notes: document.getElementById("marketManualNotes").value,
        priceKind: "market",
      },
    });
    await loadMarketAdmin();
  } catch (error) {
    showError("marketManualError", error.message);
  }
});

document.getElementById("marketRefreshBtn")?.addEventListener("click", async () => {
  showError("marketManualError", "");
  try {
    await api("POST", "/api/staff/market/refresh", { auth: true });
    await loadMarketAdmin();
  } catch (error) {
    showError("marketManualError", error.message);
  }
});

document.querySelectorAll("[data-intake]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById("intakeCrop").value = "Maize";
    if (btn.dataset.intake === "wet") {
      document.getElementById("intakeWeight").value = "65";
      document.getElementById("intakeMoisture").value = "15.1";
    } else {
      document.getElementById("intakeWeight").value = "82";
      document.getElementById("intakeMoisture").value = "12.4";
    }
  });
});

document.getElementById("intakeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedId) return;
  showError("intakeError", "");
  try {
    await api("POST", "/api/staff/warehouse/intake", {
      auth: true,
      body: {
        farmerId: selectedId,
        crop: document.getElementById("intakeCrop").value,
        weightKg: document.getElementById("intakeWeight").value,
        moisturePct: document.getElementById("intakeMoisture").value,
      },
    });
    const list = await api("GET", "/api/staff/farmers", { auth: true });
    summaries = list.farmers || [];
    renderList();
    await loadWarehouse();
    await openFarmer(selectedId);
  } catch (error) {
    showError("intakeError", error.message);
  }
});

document.querySelectorAll("[data-offer]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.offer === "low") {
      document.getElementById("offerBuyer").value = "Kanyenda Vendor Group";
      document.getElementById("offerCrop").value = "Groundnuts";
      document.getElementById("offerDistrict").value = "Kasungu";
      document.getElementById("offerPrice").value = "380";
    } else {
      document.getElementById("offerBuyer").value = "AgroBuy Traders";
      document.getElementById("offerCrop").value = "Maize";
      document.getElementById("offerDistrict").value = "Nkhotakota";
      document.getElementById("offerPrice").value = "610";
    }
  });
});

document.getElementById("contractForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("offerError", "");
  try {
    const body = {
      buyer: document.getElementById("offerBuyer").value,
      crop: document.getElementById("offerCrop").value,
      district: document.getElementById("offerDistrict").value,
      pricePerKg: Number(document.getElementById("offerPrice").value),
    };
    if (document.getElementById("offerLinkFarmer").checked && selectedId) {
      body.farmerId = selectedId;
    }
    const result = await api("POST", "/api/staff/contracts", { auth: true, body });
    monitor = result.monitor || monitor;
    renderMonitor();
    if (result.stageAdvanced && selectedId) {
      const list = await api("GET", "/api/staff/farmers", { auth: true });
      summaries = list.farmers || [];
      renderList();
      await openFarmer(selectedId);
    }
  } catch (error) {
    showError("offerError", error.message);
  }
});

document.getElementById("floorForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("floorError", "");
  try {
    const payload = await api("PUT", "/api/staff/floors", {
      auth: true,
      body: {
        crop: document.getElementById("floorCrop").value,
        pricePerKg: Number(document.getElementById("floorPrice").value),
      },
    });
    monitor.floors = payload.floors;
    renderMonitor();
  } catch (error) {
    showError("floorError", error.message);
  }
});

async function boot() {
  try {
    const health = await api("GET", "/health");
    serverPill.textContent = health.ok ? "Server connected" : "Server issue";
    serverPill.className = "server-pill " + (health.ok ? "ok" : "bad");
  } catch {
    serverPill.textContent = "Server offline";
    serverPill.className = "server-pill bad";
  }
  const stagePayload = await api("GET", "/api/stages");
  stages = stagePayload.stages || [];
  const cropPayload = await api("GET", "/api/warehouse/crops");
  crops = cropPayload.crops || [];
  fillCrops();
  const districtPayload = await api("GET", "/api/districts");
  districts = districtPayload.districts || [];
  if (token) {
    try { await loadDesk(); } catch { logout(); }
  }
}

boot();
