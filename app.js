const API = "api.php";
const DEVICE_FILTER = "106";
const $ = id => document.getElementById(id);

function updateClock(){
  const now = new Date();
  $("clock").textContent = now.toLocaleTimeString("en-GB",{hour12:false});
  $("date").textContent = now.toLocaleDateString("en-GB",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}).toUpperCase();
}
setInterval(updateClock,1000); updateClock();

function showError(message){
  $("connection").innerHTML = "<i></i> Server unavailable";
  $("connection").style.color = "#fca5a5";
  $("alertTitle").textContent = "Unable to load live sensor data";
  $("alertText").textContent = message;
  $("alertBadge").textContent = "OFFLINE";
}

async function refreshDashboard(){
  try{
    const response = await fetch(`${API}?action=latest&device_id=${encodeURIComponent(DEVICE_FILTER)}&t=${Date.now()}`,{cache:"no-store"});
    const result = await response.json();
    if(!response.ok || !result.success) throw new Error(result.message || "API request failed");
    $("connection").innerHTML = "<i></i> Server connected";
    $("connection").style.color = "#6ee7b7";
    if(!result.data){ $("alertTitle").textContent="Waiting for first ESP32 reading"; $("alertText").textContent="No data has been received for this device yet."; return; }
    const d=result.data, depth=Number(d.ultrasonic_distance);
    $("depthValue").textContent=depth.toFixed(1);
    $("depthM").textContent=(depth/100).toFixed(2)+" m";
    $("depthFt").textContent=(depth/30.48).toFixed(2)+" ft";
    $("waterFill").style.height=Math.max(0,Math.min(100,depth/350*100))+"%";
    $("deviceId").textContent=d.device_id; $("deviceMetric").textContent=d.device_id;
    $("placeName").textContent=(d.place||"Unknown")+" · WATER LEVEL";
    $("placeMetric").textContent=d.place||"—";
    $("lastUpdated").textContent=new Date(d.created_at+"Z").toLocaleString();
    $("age").textContent="Latest saved server reading";
    $("alertTitle").textContent="Sensor data received";
    $("alertText").textContent=`Device ${d.device_id} at ${d.place} reported ${depth.toFixed(2)} cm.`;
    $("alertBadge").textContent="RECEIVING";
  }catch(e){showError(e.message);}
  await refreshHistory();
}
async function refreshHistory(){
  try{
    const response=await fetch(`${API}?action=history&device_id=${encodeURIComponent(DEVICE_FILTER)}&limit=20&t=${Date.now()}`,{cache:"no-store"});
    const result=await response.json(); if(!response.ok||!result.success) throw new Error(result.message);
    const rows=result.data||[];
    $("history").innerHTML=rows.length?rows.map(r=>`<tr><td>${new Date(r.created_at+"Z").toLocaleString()}</td><td>${escapeHtml(r.device_id)}</td><td>${escapeHtml(r.place)}</td><td>${Number(r.ultrasonic_distance).toFixed(2)}</td></tr>`).join(""):'<tr><td colspan="4" class="empty">No readings stored yet.</td></tr>';
  }catch(e){$("history").innerHTML='<tr><td colspan="4" class="empty">Could not load history.</td></tr>';}
}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
$("refreshBtn").addEventListener("click",refreshDashboard);
refreshDashboard(); setInterval(refreshDashboard,10000);
