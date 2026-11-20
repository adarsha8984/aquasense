javascript
const API = "data.json";
const DEVICE_FILTER = "106";

const $ = id => document.getElementById(id);

// =========================
// CLOCK
// =========================
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

setInterval(updateClock, 1000);
updateClock();


// =========================
// ERROR
// =========================
function showError(message) {
  $("connection").innerHTML = "<i></i> Server unavailable";
  $("connection").style.color = "#fca5a5";

  $("alertTitle").textContent = "Unable to load sensor data";
  $("alertText").textContent = message || "Could not load data.json";

  $("alertBadge").textContent = "OFFLINE";
}


// =========================
// LOAD DATA.JSON
// =========================
async function loadData() {
  const response = await fetch(`${API}?t=${Date.now()}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`data.json HTTP error: ${response.status}`);
  }

  const data = await response.json();

  return data;
}


// =========================
// GET LATEST READING
// =========================
function getLatestReading(data) {

  // Case 1:
  // data.json contains:
  // {
  //   "device_id": "106",
  //   ...
  // }
  if (!Array.isArray(data)) {
    return data;
  }

  // Case 2:
  // data.json contains an array
  // [
  //   {...},
  //   {...}
  // ]

  if (data.length === 0) {
    return null;
  }

  // Filter device
  const filtered = data.filter(
    d => String(d.device_id) === String(DEVICE_FILTER)
  );

  if (filtered.length === 0) {
    return null;
  }

  // Latest first
  filtered.sort((a, b) => {
    return new Date(getTimestamp(b)) - new Date(getTimestamp(a));
  });

  return filtered[0];
}


// =========================
// GET HISTORY
// =========================
function getHistory(data) {

  if (!Array.isArray(data)) {
    return [data];
  }

  return data
    .filter(d =>
      String(d.device_id) === String(DEVICE_FILTER)
    )
    .sort((a, b) => {
      return new Date(getTimestamp(b)) -
             new Date(getTimestamp(a));
    })
    .slice(0, 20);
}


// =========================
// TIMESTAMP
// =========================
function getTimestamp(data) {

  return (
    data.created_at ||
    data.timestamp ||
    data.time ||
    new Date().toISOString()
  );
}


// =========================
// UPDATE DASHBOARD
// =========================
async function refreshDashboard() {

  try {

    const data = await loadData();

    const latest = getLatestReading(data);

    // Connection OK
    $("connection").innerHTML =
      "<i></i> Data connected";

    $("connection").style.color = "#6ee7b7";

    // No data
    if (!latest) {

      $("alertTitle").textContent =
        "Waiting for sensor data";

      $("alertText").textContent =
        `No data found for device ${DEVICE_FILTER}.`;

      $("alertBadge").textContent =
        "WAITING";

      return;
    }


    // =========================
    // VALUES
    // =========================

    const depth = Number(
      latest.ultrasonic_distance ??
      latest.depth_cm ??
      latest.depth ??
      0
    );

    const deviceId =
      latest.device_id ?? DEVICE_FILTER;

    const place =
      latest.place ?? "Unknown";


    // =========================
    // DEPTH
    // =========================

    $("depthValue").textContent =
      depth.toFixed(1);

    $("depthM").textContent =
      (depth / 100).toFixed(2) + " m";

    $("depthFt").textContent =
      (depth / 30.48).toFixed(2) + " ft";


    // =========================
    // WATER LEVEL
    // =========================

    const fillPercent =
      Math.max(
        0,
        Math.min(
          100,
          (depth / 350) * 100
        )
      );

    $("waterFill").style.height =
      fillPercent + "%";


    // =========================
    // DEVICE
    // =========================

    $("deviceId").textContent =
      deviceId;

    $("deviceMetric").textContent =
      deviceId;


    // =========================
    // PLACE
    // =========================

    $("placeName").textContent =
      `${place} · WATER LEVEL`;

    $("placeMetric").textContent =
      place;


    // =========================
    // LAST UPDATED
    // =========================

    const timestamp =
      getTimestamp(latest);

    const dateObject =
      new Date(timestamp);

    if (!isNaN(dateObject.getTime())) {

      $("lastUpdated").textContent =
        dateObject.toLocaleString();

    } else {

      $("lastUpdated").textContent =
        timestamp;

    }


    $("age").textContent =
      "Latest saved reading";


    // =========================
    // ALERT
    // =========================

    $("alertTitle").textContent =
      "Sensor data received";

    $("alertText").textContent =
      `Device ${deviceId} at ${place} reported ${depth.toFixed(2)} cm.`;

    $("alertBadge").textContent =
      "RECEIVING";


    // =========================
    // HISTORY
    // =========================

    refreshHistory(data);

  }

  catch (error) {

    console.error("AquaSense error:", error);

    showError(error.message);

    $("history").innerHTML =
      `<tr>
        <td colspan="4" class="empty">
          Could not load data.json.
        </td>
      </tr>`;

  }
}


// =========================
// HISTORY TABLE
// =========================
function refreshHistory(data) {

  try {

    const rows =
      getHistory(data);

    if (!rows.length) {

      $("history").innerHTML =
        `<tr>
          <td colspan="4" class="empty">
            No readings stored yet.
          </td>
        </tr>`;

      return;
    }


    $("history").innerHTML =
      rows.map(r => {

        const timestamp =
          getTimestamp(r);

        const date =
          new Date(timestamp);

        const dateText =
          !isNaN(date.getTime())
            ? date.toLocaleString()
            : timestamp;

        const depth =
          Number(
            r.ultrasonic_distance ??
            r.depth_cm ??
            r.depth ??
            0
          );

        return `
          <tr>
            <td>${escapeHtml(dateText)}</td>

            <td>
              ${escapeHtml(r.device_id ?? "")}
            </td>

            <td>
              ${escapeHtml(r.place ?? "")}
            </td>

            <td>
              ${depth.toFixed(2)}
            </td>
          </tr>
        `;

      }).join("");

  }

  catch (error) {

    console.error(
      "History error:",
      error
    );

    $("history").innerHTML =
      `<tr>
        <td colspan="4" class="empty">
          Could not load history.
        </td>
      </tr>`;

  }
}


// =========================
// HTML ESCAPE
// =========================
function escapeHtml(value) {

  return String(value ?? "")
    .replace(
      /[&<>"']/g,
      c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[c])
    );

}


// =========================
// REFRESH BUTTON
// =========================
$("refreshBtn")
  .addEventListener(
    "click",
    refreshDashboard
  );


// =========================
// INITIAL LOAD
// =========================
refreshDashboard();


// =========================
// AUTO REFRESH
// =========================
setInterval(
  refreshDashboard,
  10000
);
