const wireLog = document.getElementById("wireLog");
const ussdScreen = document.getElementById("ussdScreen");
const ussdKeys = document.getElementById("ussdKeys");

let ussdText = "";
let ussdOpen = false;

function addWire(method, path, requestBody, responseBody, httpStatus) {
  if (!wireLog) return;
  const item = document.createElement("article");
  item.className = "wire-item";
  item.innerHTML = `
    <header><strong>${method}</strong> ${path} · ${httpStatus}</header>
    ${requestBody != null ? `<pre>${JSON.stringify(requestBody, null, 2)}</pre>` : ""}
    <pre>${typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody, null, 2)}</pre>`;
  wireLog.prepend(item);
}

async function api(method, path, { body, plain = false } = {}) {
  const headers = {};
  if (body != null) headers["Content-Type"] = "application/json";
  const res = await fetch(path, {
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
    throw new Error((parsed && parsed.error) || raw || res.statusText);
  }
  return parsed;
}

function renderUssdKeypad(open) {
  ussdKeys.innerHTML = "";
  if (!open) return;
  for (let n = 1; n <= 9; n += 1) {
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
  const reply = await api("POST", "/ussd", {
    body: { sessionId: "browser-sim", serviceCode: "*413#", phoneNumber, text },
    plain: true,
  });
  ussdScreen.textContent = String(reply).replace(/^(CON|END) /, "");
  ussdOpen = String(reply).startsWith("CON ");
  renderUssdKeypad(ussdOpen);
  if (!ussdOpen) ussdText = "";
}

async function sendUssdKey(key) {
  if (!ussdOpen) return;
  ussdText = ussdText ? `${ussdText}*${key}` : key;
  await sendUssd(ussdText);
}

document.getElementById("clearWire")?.addEventListener("click", () => {
  if (wireLog) wireLog.innerHTML = "";
});

document.getElementById("ussdDial")?.addEventListener("click", async () => {
  ussdText = "";
  try {
    await sendUssd("");
  } catch (error) {
    ussdScreen.textContent = error.message;
  }
});

document.getElementById("ussdHangup")?.addEventListener("click", () => {
  ussdText = "";
  ussdOpen = false;
  renderUssdKeypad(false);
  ussdScreen.textContent = "Session ended. Press Dial to start again.";
});

renderUssdKeypad(false);
