/* ==========================================================================
   popup.js — Intelligence Card renderer (right slide-in panel)
   ========================================================================== */

function initPopup() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeIntelCard();
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dmsString(dec, isLat) {
  const abs = Math.abs(dec);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  const hemi = isLat ? (dec >= 0 ? "N" : "S") : (dec >= 0 ? "E" : "W");
  return `${deg}°${min}'${sec}" ${hemi}`;
}

function openIntelCard(feature, marker) {
  AppState.selectedFeature = feature;
  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  const cat = AppState.categoryById[p.category] || {};
  const color = p.color || cat.color || "#00D4FF";

  let html = "";
  html += `<div class="intel-header">
    <div class="intel-header-top">
      <div class="intel-badges">
        <span class="category-badge" style="color:${color};">${escapeHtml(p.category_label || p.category)}</span>
        <span class="threat-badge ${p.threat_level}">${p.threat_level}</span>
      </div>
      <button class="intel-close-btn" id="intel-close-btn" aria-label="Close">&times;</button>
    </div>
    <div class="intel-title"><span>${escapeHtml(p.name)}</span></div>
  </div>`;

  html += `<div class="intel-body">`;

  // Coordinates
  html += `<div class="intel-section">
    <div class="intel-section-title">Coordinates</div>
    <div class="coord-display">${dmsString(lat, true)} &nbsp; ${dmsString(lng, false)}</div>
    <div class="coord-sub">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
  </div>`;

  // Portals (tunnels)
  if (p.portal_1 || p.portal_2) {
    html += `<div class="intel-section"><div class="intel-section-title">Tunnel Portals</div><div class="portal-row">`;
    if (p.portal_1) {
      html += `<div class="portal-item"><span>${escapeHtml(p.portal_1.label)}</span><span>${p.portal_1.lat.toFixed(5)}, ${p.portal_1.lon.toFixed(5)}</span></div>`;
    }
    if (p.portal_2) {
      html += `<div class="portal-item"><span>${escapeHtml(p.portal_2.label)}</span><span>${p.portal_2.lat.toFixed(5)}, ${p.portal_2.lon.toFixed(5)}</span></div>`;
    }
    html += `</div></div>`;
  }

  // RTP (railway)
  if (p.rtp) {
    html += `<div class="intel-section"><div class="intel-section-title">Rail Transfer Point</div>
      <div class="portal-item"><span>RTP</span><span>${p.rtp.lat.toFixed(5)}, ${p.rtp.lon.toFixed(5)}</span></div>
    </div>`;
  }

  // Intelligence fields
  if (p.display_fields && p.display_fields.length) {
    html += `<div class="intel-section">
      <div class="intel-section-title">Intelligence Fields</div>
      <div class="field-grid">`;
    p.display_fields.forEach((f) => {
      html += `<div class="field-row"><span class="field-label">${escapeHtml(f.label)}</span><span class="field-value">${escapeHtml(f.value)}</span></div>`;
    });
    html += `</div></div>`;

    const appleField = p.display_fields.find((f) => f.label.toLowerCase() === "apple" && f.value.toLowerCase() === "yes");
    if (appleField) {
      html += `<div class="apple-verified-badge">✓ APPLE MAPS VERIFIED</div>`;
    }
  }

  // Actions
  const gEarthUrl = `https://earth.google.com/web/@${lat},${lng},1000a,3000d,35y,0h,0t,0r`;
  html += `<div class="intel-section">
    <div class="intel-actions">
      <a class="intel-action-btn" href="${gEarthUrl}" target="_blank" rel="noopener">🌍 VIEW ON GOOGLE EARTH</a>
      <button class="intel-action-btn" id="copy-coords-btn" data-lat="${lat}" data-lng="${lng}">📋 COPY COORDINATES</button>
    </div>
  </div>`;

  html += `</div>`; // .intel-body

  document.getElementById("intel-card-inner").innerHTML = html;
  document.getElementById("intel-card").classList.add("open");

  document.getElementById("intel-close-btn").addEventListener("click", closeIntelCard);
  document.getElementById("copy-coords-btn").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const text = `${btn.dataset.lat}, ${btn.dataset.lng}`;
    copyToClipboard(text);
    btn.classList.add("copied");
    btn.textContent = "✓ COPIED";
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.textContent = "📋 COPY COORDINATES";
    }, 1600);
    showToast("Coordinates copied to clipboard");
  });
}

function closeIntelCard() {
  document.getElementById("intel-card").classList.remove("open");
  AppState.selectedFeature = null;
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) { /* no-op */ }
  document.body.removeChild(ta);
}

let toastTimer = null;
function showToast(msg) {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2000);
}
