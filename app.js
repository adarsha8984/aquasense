
// ==========================================
// AQUASENSE PRO - LIVE WATER LEVEL DASHBOARD
// ==========================================

const DATA_URL = "data.json";
const DEVICE_FILTER = "106";
const REFRESH_INTERVAL = 10000;

let waterChart = null;
let refreshInProgress = false;


// ==========================================
// ELEMENT HELPER
// ==========================================

const $ = id => document.getElementById(id);


// ==========================================
// DIGITAL CLOCK
// ==========================================

function updateClock() {

  const now = new Date();

  $("clock").textContent =
    now.toLocaleTimeString("en-GB", {
      hour12: false
    });

  $("date").textContent =
    now.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).toUpperCase();

}

updateClock();
setInterval(updateClock, 1000);


// ==========================================
// CONNECTION STATUS
// ==========================================

function setStatus(online, message = "") {

  $("connection").innerHTML =
    `<i></i> ${online ? "JSON Connected" : "Disconnected"}`;

  $("connection").style.color =
    online ? "#6ee7b7" : "#fca5a5";

  if (!online) {

    $("alertTitle").textContent =
      "Unable to receive sensor data";

    $("alertText").textContent = message;

    $("alertBadge").textContent = "OFFLINE";

    $("alertBadge").style.color = "#fca5a5";

  } else {

    $("alertBadge").style.color = "#6ee7b7";

  }

}


// ==========================================
// DATE FUNCTIONS
// ==========================================

function normalizeDate(value) {

  if (!value) return null;

  let normalized = String(value);

  if (/[+-]\d{4}$/.test(normalized)) {

    normalized = normalized.replace(
      /([+-]\d{2})(\d{2})$/,
      "$1:$2"
    );

  }

  const date = new Date(normalized);

  return Number.isNaN(date.getTime())
    ? null
    : date;

}


function formatDate(value) {

  if (!value) return "—";

  const date = normalizeDate(value);

  return date
    ? date.toLocaleString()
    : String(value);

}


function chartLabel(value) {

  const date = normalizeDate(value);

  return date
    ? date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      })
    : String(value || "—");

}


// ==========================================
// SENSOR DEPTH
// ==========================================

function getDepth(reading) {

  if (!reading || typeof reading !== "object") {
    return null;
  }

  const value =
    reading.ultrasonic_distance ??
    reading.depth_cm ??
    reading.depth ??
    reading.distance_cm;

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;

}


// ==========================================
// FILTER DEVICE
// ==========================================

function isCorrectDevice(reading) {

  if (
    reading.device_id === undefined ||
    reading.device_id === null ||
    reading.device_id === ""
  ) {
    return true;
  }

  return String(reading.device_id) === DEVICE_FILTER;

}


// ==========================================
// INITIALIZE GRAPH
// ==========================================

function initializeWaterChart() {

  const canvas = $("waterChart");

  if (!canvas) return;

  if (typeof Chart === "undefined") {

    $("graphStatus").textContent =
      "Chart.js failed to load";

    return;

  }

  waterChart = new Chart(canvas, {

    type: "line",

    data: {

      labels: [],

      datasets: [{

        label: "Water Level (cm)",

        data: [],

        borderColor: "#22d3ee",

        backgroundColor: "rgba(34, 211, 238, 0.13)",

        borderWidth: 2.5,

        fill: true,

        tension: 0.35,

        pointRadius: 4,

        pointHoverRadius: 7,

        pointBackgroundColor: "#22d3ee",

        pointBorderColor: "#ffffff",

        pointBorderWidth: 1

      }]

    },

    options: {

      responsive: true,

      maintainAspectRatio: false,

      animation: {
        duration: 400
      },

      interaction: {
        intersect: false,
        mode: "index"
      },

      plugins: {

        legend: {
          display: false
        },

        tooltip: {

          backgroundColor: "#0f172a",

          titleColor: "#ffffff",

          bodyColor: "#67e8f9",

          borderColor: "#164e63",

          borderWidth: 1,

          padding: 12,

          callbacks: {

            label: function(context) {

              return " " +
                Number(context.parsed.y).toFixed(2) +
                " cm";

            }

          }

        }

      },

      scales: {

        x: {

          grid: {
            color: "rgba(148,163,184,0.08)"
          },

          ticks: {
            color: "#94a3b8",
            maxTicksLimit: 6,
            maxRotation: 0
          }

        },

        y: {

          beginAtZero: true,

          grid: {
            color: "rgba(148,163,184,0.12)"
          },

          ticks: {
            color: "#94a3b8"
          },

          title: {
            display: true,
            text: "Distance (cm)",
            color: "#94a3b8"
          }

        }

      }

    }

  });

}


// ==========================================
// UPDATE GRAPH
// ==========================================

function renderChart(rows) {

  if (!waterChart) return;

  const validRows = rows

    .filter(isCorrectDevice)

    .filter(row => getDepth(row) !== null)

    .slice(-20);

  waterChart.data.labels =
    validRows.map(row =>
      chartLabel(row.created_at ?? row.timestamp)
    );

  waterChart.data.datasets[0].data =
    validRows.map(row => getDepth(row));

  waterChart.update();

  if (validRows.length > 0) {

    const latest =
      getDepth(validRows[validRows.length - 1]);

    $("graphStatus").textContent =
      `${validRows.length} readings · ${latest.toFixed(2)} cm`;

  } else {

    $("graphStatus").textContent =
      "No readings available";

  }

}


// ==========================================
// UPDATE WATER TANK
// ==========================================

function renderLatest(data) {

  if (!data) {

    $("depthValue").textContent = "--";
    $("depthM").textContent = "-- m";
    $("depthFt").textContent = "-- ft";
    $("waterFill").style.height = "0%";

    return;

  }

  const depth = getDepth(data);

  if (depth === null) {

    throw new Error(
      "Invalid ultrasonic_distance in data.json"
    );

  }

  // CENTIMETRES
  $("depthValue").textContent =
    depth.toFixed(1);

  // METRES
  $("depthM").textContent =
    (depth / 100).toFixed(2) + " m";

  // FEET
  $("depthFt").textContent =
    (depth / 30.48).toFixed(2) + " ft";

  // WATER TANK ANIMATION
  const fillPercentage =
    Math.max(0, Math.min(100, (depth / 350) * 100));

  $("waterFill").style.height =
    fillPercentage + "%";

  // LOCATION
  const place = data.place || "BBSR";

  $("placeName").textContent =
    place + " · MAIN WATER BODY";

  $("placeMetric").textContent =
    place;

  // HEADER DEVICE ID
  $("deviceId").textContent =
    data.device_id ?? DEVICE_FILTER;

  // SENSOR ALERT
  $("alertTitle").textContent =
    "Sensor data received";

  $("alertText").textContent =
    `Device ${data.device_id ?? DEVICE_FILTER} at ${place} reported ${depth.toFixed(2)} cm.`;

  $("alertBadge").textContent =
    "RECEIVING";

}


// ==========================================
// SAFE HTML
// ==========================================

function escapeHtml(value) {

  return String(value ?? "").replace(/[&<>"']/g, char => ({

    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"

  }[char]));

}


// ==========================================
// UPDATE HISTORY TABLE
// ==========================================

function renderHistory(rows) {

  const filtered = rows

    .filter(isCorrectDevice)

    .filter(row => getDepth(row) !== null)

    .slice(-20)

    .reverse();

  if (!filtered.length) {

    $("history").innerHTML = `
      <tr>
        <td colspan="4" class="empty">
          No sensor readings available.
        </td>
      </tr>
    `;

    return;

  }

  $("history").innerHTML = filtered.map(row => `

    <tr>

      <td>
        ${escapeHtml(
          formatDate(row.created_at ?? row.timestamp)
        )}
      </td>

      <td>
        ${escapeHtml(row.device_id ?? DEVICE_FILTER)}
      </td>

      <td>
        ${escapeHtml(row.place ?? "BBSR")}
      </td>

      <td>
        ${getDepth(row).toFixed(2)}
      </td>

    </tr>

  `).join("");

}


// ==========================================
// NORMALIZE JSON FORMAT
// Supports:
// 1. Array of sensor readings
// 2. { latest, history }
// 3. { latest, readings }
// 4. { data: [...] }
// 5. Single sensor object
// ==========================================

function normalizeData(result) {

  let rows = [];
  let latest = null;

  if (Array.isArray(result)) {

    rows = result;

  } else if (result && typeof result === "object") {

    if (Array.isArray(result.history)) {

      rows = result.history;

    } else if (Array.isArray(result.readings)) {

      rows = result.readings;

    } else if (Array.isArray(result.data)) {

      rows = result.data;

    } else if (result.data && typeof result.data === "object") {

      latest = result.data;

    }

    if (result.latest && typeof result.latest === "object") {

      latest = result.latest;

    } else if (
      result.ultrasonic_distance !== undefined ||
      result.depth_cm !== undefined ||
      result.depth !== undefined ||
      result.distance_cm !== undefined
    ) {

      latest = result;

    }

  }

  if (!latest && rows.length > 0) {

    latest = rows[rows.length - 1];

  }

  if (latest && !rows.some(row =>
    row.created_at === latest.created_at &&
    getDepth(row) === getDepth(latest)
  )) {

    rows = [...rows, latest];

  }

  return {
    latest,
    rows
  };

}


// ==========================================
// FETCH JSON FROM GITHUB PAGES
// ==========================================

async function refreshDashboard() {

  if (refreshInProgress) return;

  refreshInProgress = true;

  try {

    const response = await fetch(
      `${DATA_URL}?t=${Date.now()}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status}: Cannot load data.json`
      );

    }

    const result = await response.json();

    const normalized = normalizeData(result);

    const latest = normalized.latest;
    const rows = normalized.rows;

    // CONNECTION
    setStatus(true);

    // MAIN WATER LEVEL
    renderLatest(latest);

    // HISTORY
    renderHistory(rows);

    // GRAPH
    renderChart(rows);

    // FOOTER
    $("serverNote").textContent =
      "Last refresh: " +
      new Date().toLocaleTimeString();

  } catch (error) {

    console.error("AquaSense error:", error);

    setStatus(false, error.message);

    $("graphStatus").textContent =
      "Could not load data.json";

  } finally {

    refreshInProgress = false;

  }

}


// ==========================================
// START DASHBOARD
// ==========================================

initializeWaterChart();

$("refreshBtn").addEventListener(
  "click",
  refreshDashboard
);

// LOAD FIRST READING
refreshDashboard();

// AUTO REFRESH EVERY 10 SECONDS
setInterval(
  refreshDashboard,
  REFRESH_INTERVAL
);
