/* ==========================================================================
   sidebar.js — layer legend, search/filter, threat & mode controls
   ========================================================================== */

function buildSearchIndex() {
  AppState.searchIndex = AppState.allFeatures.map((f) => {
    const p = f.properties;
    const parts = [p.name, p.category_label];
    (p.display_fields || []).forEach((d) => parts.push(d.value));
    return {
      feature: f,
      text: parts.filter(Boolean).join(" | ").toLowerCase(),
    };
  });
}

function initSidebar() {
  renderLayerList();
  bindSearch();
  bindModeToggles();
  bindThreatFilter();
  bindLayerBulkActions();
  bindLabelsToggle();
  bindTunnelsToggle();
  bindSidebarCollapse();
}

/* ---------------- Layer list ---------------- */
function renderLayerList() {
  const container = document.getElementById("layer-list");
  container.innerHTML = "";
  AppState.categories
    .slice()
    .sort((a, b) => b.count - a.count)
    .forEach((cat) => {
      const row = document.createElement("div");
      row.className = "layer-row";
      row.dataset.cat = cat.id;
      row.innerHTML = `
        <input type="checkbox" id="layer-cb-${cssSafe(cat.id)}" ${cat.defaultVisible ? "checked" : ""} />
        <span class="layer-color-dot" style="background:${cat.color}; color:${cat.color};"></span>
        <label class="layer-label" for="layer-cb-${cssSafe(cat.id)}">${escapeHtml(cat.label)}</label>
        <span class="layer-count">${cat.count}</span>
      `;
      container.appendChild(row);

      const cb = row.querySelector("input");
      cb.addEventListener("change", () => {
        if (cb.checked) AppState.visibleCategories.add(cat.id);
        else AppState.visibleCategories.delete(cat.id);
        updateLayerRowDimmed(cat.id);
        applyLayerVisibility();
      });
      updateLayerRowDimmed(cat.id);
    });
}

function cssSafe(id) {
  return id.replace(/[^a-z0-9]/gi, "_");
}

function updateLayerRowDimmed(catId) {
  const row = document.querySelector(`.layer-row[data-cat="${cssEscape(catId)}"]`);
  if (!row) return;
  row.classList.toggle("dimmed", !categoryEffectivelyVisible(catId));
}

function cssEscape(str) {
  return str.replace(/(["\\])/g, "\\$1");
}

function syncLayerCheckbox(catId, checked) {
  const cb = document.getElementById(`layer-cb-${cssSafe(catId)}`);
  if (cb) cb.checked = checked;
  updateLayerRowDimmed(catId);
}

function bindLayerBulkActions() {
  document.getElementById("layers-select-all").addEventListener("click", () => {
    AppState.categories.forEach((c) => {
      AppState.visibleCategories.add(c.id);
      syncLayerCheckbox(c.id, true);
    });
    applyLayerVisibility();
  });
  document.getElementById("layers-select-none").addEventListener("click", () => {
    AppState.categories.forEach((c) => {
      AppState.visibleCategories.delete(c.id);
      syncLayerCheckbox(c.id, false);
    });
    applyLayerVisibility();
  });
}

/* ---------------- Search ---------------- */
function bindSearch() {
  const input = document.getElementById("search-input");
  const clearBtn = document.getElementById("search-clear");
  const resultsEl = document.getElementById("search-results");

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    clearBtn.classList.toggle("visible", q.length > 0);
    if (!q) {
      resultsEl.innerHTML = "";
      return;
    }
    const matches = AppState.searchIndex.filter((entry) => entry.text.includes(q)).slice(0, 60);
    renderSearchResults(matches, q);
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    resultsEl.innerHTML = "";
    clearBtn.classList.remove("visible");
    input.focus();
  });
}

function renderSearchResults(matches, query) {
  const resultsEl = document.getElementById("search-results");
  if (!matches.length) {
    resultsEl.innerHTML = `<div class="search-results-empty">No matches for "${escapeHtml(query)}"</div>`;
    return;
  }
  let html = `<div class="search-results-count">${matches.length} match${matches.length === 1 ? "" : "es"}</div>`;
  matches.forEach((m, idx) => {
    const p = m.feature.properties;
    const cat = AppState.categoryById[p.category] || {};
    html += `<div class="search-result-item" data-idx="${idx}">
      <span class="search-result-dot" style="background:${cat.color || '#00D4FF'}"></span>
      <div class="search-result-text">
        <div class="search-result-name">${escapeHtml(p.name)}</div>
        <div class="search-result-cat">${escapeHtml(p.category_label || p.category)}</div>
      </div>
    </div>`;
  });
  resultsEl.innerHTML = html;
  resultsEl.querySelectorAll(".search-result-item").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.idx, 10);
      panToFeature(matches[idx].feature);
    });
  });
}

/* ---------------- Mode / basemap toggles ---------------- */
function bindModeToggles() {
  document.querySelectorAll("#mode-toggle .mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      syncModeButtons(btn.dataset.mode);
      setMode(btn.dataset.mode);
    });
  });
  document.querySelectorAll("#basemap-toggle .mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#basemap-toggle .mode-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      setBasemap(btn.dataset.basemap);
      const labelsRow = document.getElementById("labels-toggle-row");
      labelsRow.style.opacity = btn.dataset.basemap === "satellite" ? "1" : "0.4";
      labelsRow.style.pointerEvents = btn.dataset.basemap === "satellite" ? "auto" : "none";
    });
  });
}

function syncModeButtons(mode) {
  document.querySelectorAll("#mode-toggle .mode-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
}

function bindLabelsToggle() {
  document.getElementById("labels-toggle").addEventListener("change", (e) => {
    setLabelsVisible(e.target.checked);
  });
}

function bindTunnelsToggle() {
  document.getElementById("tunnels-toggle").addEventListener("change", (e) => {
    setTunnelLinesVisible(e.target.checked);
  });
}

/* ---------------- Threat filter ---------------- */
function bindThreatFilter() {
  document.querySelectorAll(".threat-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const threat = chip.dataset.threat;
      const active = chip.classList.toggle("active");
      if (active) AppState.activeThreats.add(threat);
      else AppState.activeThreats.delete(threat);
      AppState.categories.forEach((c) => {
        if (c.threat === threat) updateLayerRowDimmed(c.id);
      });
      applyLayerVisibility();
    });
  });
}

function syncThreatChip(threat, active) {
  const chip = document.querySelector(`.threat-chip[data-threat="${threat}"]`);
  if (chip) chip.classList.toggle("active", active);
}

/* ---------------- Sidebar collapse ---------------- */
function bindSidebarCollapse() {
  document.getElementById("sidebar-toggle-btn").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("collapsed");
    setTimeout(() => AppState.map.invalidateSize(), 260);
  });
}
