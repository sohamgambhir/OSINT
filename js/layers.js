/* ==========================================================================
   layers.js — GeoJSON marker layers, clustering, tunnel polylines, heatmap
   ========================================================================== */

function initLayers() {
  const map = AppState.map;

  // Group features by category
  const byCategory = {};
  AppState.allFeatures.forEach((f) => {
    const cat = f.properties.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(f);
  });

  AppState.categories.forEach((cat) => {
    const feats = byCategory[cat.id] || [];
    const cluster = L.markerClusterGroup({
      iconCreateFunction: (c) => iconForCluster(c.getChildCount()),
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      maxClusterRadius: 55,
      disableClusteringAtZoom: 13,
      chunkedLoading: true,
    });

    feats.forEach((f) => {
      const [lng, lat] = f.geometry.coordinates;
      const marker = L.marker([lat, lng], { icon: buildDivIcon(cat) });
      marker.featureRef = f;
      marker.on("click", () => openIntelCard(f, marker));
      cluster.addLayer(marker);
    });

    AppState.layerGroups[cat.id] = cluster;
  });

  // Tunnel portal lines (separate always-on-top overlay, toggled independently)
  const tunnelGroup = L.layerGroup();
  AppState.tunnelLines.forEach((line) => {
    const latlngs = line.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    const pl = L.polyline(latlngs, {
      color: line.properties.color || "#8E8E93",
      weight: 2,
      dashArray: "6 5",
      opacity: 0.85,
    });
    pl.bindTooltip(line.properties.name, { sticky: true, className: "tunnel-tooltip" });
    tunnelGroup.addLayer(pl);
  });
  AppState.tunnelLineLayer = tunnelGroup;

  applyLayerVisibility();
  if (AppState.tunnelLinesOn) tunnelGroup.addTo(map);

  updateHeatLayer();
  refreshLiveStats();

  map.on("moveend zoomend", refreshLiveStats);
}

/** Effective visibility = category checked AND its threat level active AND not in heatmap-only mode */
function categoryEffectivelyVisible(catId) {
  const cat = AppState.categoryById[catId];
  if (!cat) return false;
  return AppState.visibleCategories.has(catId) && AppState.activeThreats.has(cat.threat);
}

function applyLayerVisibility() {
  const map = AppState.map;
  Object.entries(AppState.layerGroups).forEach(([catId, group]) => {
    const shouldShow = AppState.mode === "pins" && categoryEffectivelyVisible(catId);
    const isShown = map.hasLayer(group);
    if (shouldShow && !isShown) group.addTo(map);
    if (!shouldShow && isShown) map.removeLayer(group);
  });
  updateHeatLayer();
  refreshLiveStats();
}

function getVisibleFeatures() {
  return AppState.allFeatures.filter((f) => categoryEffectivelyVisible(f.properties.category));
}

function updateHeatLayer() {
  const map = AppState.map;
  if (AppState.heatLayer) {
    map.removeLayer(AppState.heatLayer);
    AppState.heatLayer = null;
  }
  if (AppState.mode !== "heatmap") return;

  const points = getVisibleFeatures().map((f) => {
    const [lng, lat] = f.geometry.coordinates;
    return [lat, lng, 0.55];
  });

  AppState.heatLayer = L.heatLayer(points, {
    radius: 22,
    blur: 26,
    maxZoom: 12,
    minOpacity: 0.25,
    gradient: { 0.2: "#1a9850", 0.45: "#fee08b", 0.7: "#fc8d59", 1.0: "#d73027" },
  });
  AppState.heatLayer.addTo(map);
}

function setMode(mode) {
  AppState.mode = mode;
  applyLayerVisibility();
}

function setTunnelLinesVisible(on) {
  AppState.tunnelLinesOn = on;
  const map = AppState.map;
  if (!AppState.tunnelLineLayer) return;
  if (on && !map.hasLayer(AppState.tunnelLineLayer)) AppState.tunnelLineLayer.addTo(map);
  if (!on && map.hasLayer(AppState.tunnelLineLayer)) map.removeLayer(AppState.tunnelLineLayer);
}

function refreshLiveStats() {
  const map = AppState.map;
  if (!map) return;
  const bounds = map.getBounds();
  let inView = 0;
  const visibleFeats = getVisibleFeatures();
  visibleFeats.forEach((f) => {
    const [lng, lat] = f.geometry.coordinates;
    if (bounds.contains([lat, lng])) inView++;
  });

  const totalCats = AppState.categories.length;
  const activeCats = AppState.categories.filter((c) => categoryEffectivelyVisible(c.id)).length;

  setText("stat-in-view", inView.toLocaleString());
  setText("stat-total", AppState.allFeatures.length.toLocaleString());
  setText("stat-layers", `${activeCats}/${totalCats}`);
  setText("stat-zoom", map.getZoom());

  setText("stat-total-features", AppState.allFeatures.length.toLocaleString());
  setText("stat-visible-features", visibleFeats.length.toLocaleString());
  setText("stat-categories", activeCats);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function panToFeature(f) {
  const [lng, lat] = f.geometry.coordinates;
  const map = AppState.map;
  map.setView([lat, lng], Math.max(map.getZoom(), 12), { animate: true });

  // Ensure the feature's category+threat are visible so the marker is on-map
  const cat = f.properties.category;
  if (!AppState.visibleCategories.has(cat)) {
    AppState.visibleCategories.add(cat);
    syncLayerCheckbox(cat, true);
  }
  const catCfg = AppState.categoryById[cat];
  if (catCfg && !AppState.activeThreats.has(catCfg.threat)) {
    AppState.activeThreats.add(catCfg.threat);
    syncThreatChip(catCfg.threat, true);
  }
  if (AppState.mode !== "pins") {
    AppState.mode = "pins";
    syncModeButtons("pins");
  }
  applyLayerVisibility();

  setTimeout(() => {
    const group = AppState.layerGroups[cat];
    if (!group) return;
    group.eachLayer((marker) => {
      if (marker.featureRef === f) {
        if (group.zoomToShowLayer) {
          group.zoomToShowLayer(marker, () => {
            marker.fire("click");
            marker.openPopup && marker.openPopup();
          });
        } else {
          marker.fire("click");
        }
      }
    });
  }, 120);
}
