// GitHub Pages uses a static JSON file instead of PHP/MySQL.
const DATA_URL = "data.json";
const DEVICE_FILTER = "106";
const $ = id => document.getElementById(id);

function updateClock() {
  const now = new Date();
  $("clock").textContent = now.toLocaleTimeString("en-GB", { hour12: false });
  $("date").textContent = now.toLocaleDateString("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric"
  }).toUpperCase();
}
setInterval(updateClock, 1000);
updateClock();

function setStatus(online, message) {
  $("connection").innerHTML = `<i></i> ${online ? "JSON connected" : "Data unavailable"}`;
  $("connection").style.color = online ? "#6ee7b7" : "#fca5a5";
  if (!online) {
    $("alertTitle").textContent = "Unable to load sensor data";
    $("alertText").textContent = message;
    $("alertBadge").textContent = "OFFLINE";
  }
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function renderLatest(d) {
  if (!d) {
    $("alertTitle").textContent = "Waiting for first ESP32 reading";
    $("alertText").textContent = "No sensor reading is available in data.json yet.";
    $("alertBadge").textContent = "WAITING";
    return;
  }

  const depth = Number(d.ultrasonic_distance);
  if (!Number.isFinite(depth)) throw new Error("ultrasonic_distance must be a number in data.json.");

  $("depthValue").textContent = depth.toFixed(1);
  $("depthM").textContent = (depth / 100).toFixed(2) + " m";
  $("depthFt").textContent = (depth / 30.48).toFixed(2) + " ft";
  $("waterFill").style.height = Math.max(0, Math.min(100, depth / 350 * 100)) + "%";
  $("deviceId").textContent = d.device_id ?? DEVICE_FILTER;
  $("deviceMetric").textContent = d.device_id ?? DEVICE_FILTER;
  $("placeName").textContent = (d.place || "Unknown") + " · WATER LEVEL";
  $("placeMetric").textContent = d.place || "—";
  $("lastUpdated").textContent = formatDate(d.created_at);
  $("age").textContent = "Latest JSON reading";
  $("alertTitle").textContent = "Sensor data received";
  $("alertText").textContent = `Device ${d.device_id ?? DEVICE_FILTER} at ${d.place || "unknown location"} reported ${depth.toFixed(2)} cm.`;
  $("alertBadge").textContent = "RECEIVING";
}

function renderHistory(rows) {
  const filtered = (Array.isArray(rows) ? rows : [])
    .filter(r => !r.device_id || String(r.device_id) === DEVICE_FILTER)
    .slice(0, 20);

  $("history").innerHTML = filtered.length
    ? filtered.map(r => `<tr>
        <td>${escapeHtml(formatDate(r.created_at))}</td>
        <td>${escapeHtml(r.device_id ?? DEVICE_FILTER)}</td>
        <td>${escapeHtml(r.place ?? "—")}</td>
        <td>${Number(r.ultrasonic_distance).toFixed(2)}</td>
      </tr>`).join("")
    : '<tr><td colspan="4" class="empty">No readings stored yet.</td></tr>';
}

async function refreshDashboard() {
  try {
    const response = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${DATA_URL} (HTTP ${response.status}).`);

    const result = await response.json();
    // Supported format: { "latest": {...}, "history": [...] }
    // Also accepts a single reading object at the JSON root.
    const latest = result.latest ?? result.data ?? (
      result.ultrasonic_distance !== undefined ? result : null
    );
    const history = result.history ?? (latest ? [latest] : []);

    setStatus(true);
    renderLatest(latest);
    renderHistory(history);
  } catch (error) {
    setStatus(false, error.message);
    $("history").innerHTML = '<tr><td colspan="4" class="empty">Could not load JSON history.</td></tr>';
  }
}

$("refreshBtn").addEventListener("click", refreshDashboard);
refreshDashboard();
setInterval(refreshDashboard, 10000);
