const TOKEN_KEY = "dzalasmart.staffToken";

const authView = document.getElementById("authView");
const deskView = document.getElementById("deskView");
const wireLog = document.getElementById("wireLog");
const serverPill = document.getElementById("serverPill");

let token = localStorage.getItem(TOKEN_KEY) || "";
let staff = null;
let summaries = [];
let stages = [];
let selectedId = null;

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
}

function showDesk() {
  authView.hidden = true;
  deskView.hidden = false;
  document.getElementById("staffRole").textContent = roleLabel(staff.role);
  document.getElementById("staffName").textContent = staff.name;
  document.getElementById("staffOrg").textContent = [staff.org, staff.district, staff.epa].filter(Boolean).join(" · ");
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
  if (token) {
    try { await loadDesk(); } catch { logout(); }
  }
}

boot();
