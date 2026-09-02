const TOKEN_KEY = "dzalasmart.token";
const API_BASE_KEY = "dzalasmart.apiBase";

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
  const cleaned = String(url || "").trim().replace(/\/$/, "");
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
const wireLog = document.getElementById("wireLog");
const ussdScreen = document.getElementById("ussdScreen");
const ussdKeys = document.getElementById("ussdKeys");
const serverPill = document.getElementById("serverPill");

let token = localStorage.getItem(TOKEN_KEY) || "";
let status = null;
let districts = [];
let ussdText = "";
let ussdOpen = false;

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
  const req = requestBody == null || requestBody === "" ? "(empty)" : JSON.stringify(requestBody, null, 2);
  const res = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody, null, 2);
  item.innerHTML = `
    <header>
      <span>${method} ${path}</span>
      <span>${httpStatus}</span>
    </header>
    <pre>→ ${req}\n\n← ${res}</pre>`;
  wireLog.prepend(item);
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
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = { error: raw }; }
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
  document.getElementById("stepper").innerHTML = stages.map((stage) => {
    const cls = stage.index < current ? "done" : stage.index === current ? "current" : "";
    return `<li class="${cls}"><span class="dot"></span>${stage.name}</li>`;
  }).join("");
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
  document.getElementById("farmerPlace").textContent = [farmer.district, farmer.epa, farmer.region].filter(Boolean).join(" · ");
  document.getElementById("currentStage").textContent = status.currentStage?.name || "Not started";
  document.getElementById("nextStage").textContent = status.nextStage?.name || "Season complete";
  const btn = document.getElementById("advanceBtn");
  btn.disabled = status.seasonComplete;
  btn.textContent = status.seasonComplete
    ? "Season complete"
    : `Log ${status.nextStage.name} from this app`;
  renderStepper();
  const events = status.events || [];
  document.getElementById("eventLog").innerHTML = events.length
    ? events.map((event) => `
        <div class="event-row">
          <div>
            <strong>${event.stageName}</strong>
            <div class="hint">${fmtTime(event.createdAt)}</div>
          </div>
          <span class="channel ${event.channel}">${event.channel}</span>
        </div>`).join("")
    : `<p class="hint">No stages logged yet. Use the button above or dial *413#.</p>`;
}

async function loadStatus() {
  status = await api("GET", "/api/farmers/me/status", { auth: true });
  renderFarm();
}

function setSession(payload) {
  token = payload.token;
  localStorage.setItem(TOKEN_KEY, token);
}

function logout() {
  token = "";
  status = null;
  localStorage.removeItem(TOKEN_KEY);
  renderFarm();
  authView.hidden = false;
  farmView.hidden = true;
}

function renderUssdKeypad(open) {
  ussdKeys.innerHTML = "";
  if (!open) return;
  for (let n = 1; n <= 9; n++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(n);
    btn.setAttribute("aria-label", `USSD ${n}`);
    btn.addEventListener("click", () => sendUssdKey(String(n)));
    ussdKeys.appendChild(btn);
  }
  const zero = document.createElement("button");
  zero.type = "button";
  zero.textContent = "0";
  zero.setAttribute("aria-label", "USSD 0");
  zero.addEventListener("click", () => sendUssdKey("0"));
  ussdKeys.appendChild(zero);
}

async function sendUssd(text) {
  const phoneNumber = document.getElementById("ussdPhone").value.trim();
  const reply = await api("POST", "/ussd", { body: { sessionId: "browser-sim", serviceCode: "*413#", phoneNumber, text }, plain: true });
  ussdScreen.textContent = String(reply).replace(/^(CON|END) /, "");
  ussdOpen = String(reply).startsWith("CON ");
  renderUssdKeypad(ussdOpen);
  if (!ussdOpen) ussdText = "";
  if (status?.farmer && phoneNumber.replace(/\D/g, "").endsWith(status.farmer.phone.replace(/\D/g, "").slice(-9))) {
    try { await loadStatus(); } catch { /* still logged out or mismatch */ }
  }
}

async function sendUssdKey(key) {
  if (!ussdOpen) return;
  ussdText = ussdText ? `${ussdText}*${key}` : key;
  await sendUssd(ussdText);
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
    await loadStatus();
  } catch (error) {
    showError("loginError", error.message);
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
    await loadStatus();
  } catch (error) {
    showError("registerError", error.message);
  }
});

document.getElementById("regDistrict").addEventListener("change", fillEpas);
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("clearWire").addEventListener("click", () => { wireLog.innerHTML = ""; });

document.getElementById("advanceBtn").addEventListener("click", async () => {
  showError("advanceError", "");
  try {
    status = await api("POST", "/api/farmers/me/events", { auth: true, body: {} });
    renderFarm();
  } catch (error) {
    showError("advanceError", error.message);
  }
});

document.getElementById("ussdDial").addEventListener("click", async () => {
  ussdText = "";
  try {
    await sendUssd("");
  } catch (error) {
    ussdScreen.textContent = error.message;
  }
});

document.getElementById("ussdHangup").addEventListener("click", () => {
  ussdText = "";
  ussdOpen = false;
  renderUssdKeypad(false);
  ussdScreen.textContent = "Session ended. Press Dial to start again.";
});

document.getElementById("nativeServerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setApiBase(document.getElementById("apiBaseInput").value);
  await checkServer();
});

async function boot() {
  applyNativeShell();
  await checkServer();
  const stagePayload = await api("GET", "/api/stages");
  window.__stages = stagePayload.stages || [];
  const districtPayload = await api("GET", "/api/districts");
  districts = districtPayload.districts || [];
  fillDistricts();
  if (token) {
    try {
      await loadStatus();
    } catch {
      logout();
    }
  }
}

boot();
