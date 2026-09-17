/* ==========================================================================
   app.js — map bootstrap: tile layers, base controls, minimap, coord HUD
   ========================================================================== */

let satelliteLayer, labelsLayer, darkLayer;

function initMap() {
  const map = L.map("map", {
    center: [APP_CONFIG.initialView.lat, APP_CONFIG.initialView.lng],
    zoom: APP_CONFIG.initialView.zoom,
    zoomControl: false,
    worldCopyJump: true,
    minZoom: 3,
    maxZoom: 18,
    attributionControl: true,
  });

  AppState.map = map;

  // ---- Tile layers ----
  satelliteLayer = L.tileLayer(APP_CONFIG.tiles.satellite.url, {
    attribution: APP_CONFIG.tiles.satellite.attribution,
    maxZoom: APP_CONFIG.tiles.satellite.maxZoom,
  });

  labelsLayer = L.tileLayer(APP_CONFIG.tiles.labels.url, {
    attribution: APP_CONFIG.tiles.labels.attribution,
    maxZoom: APP_CONFIG.tiles.labels.maxZoom,
    pane: "overlayPane",
  });

  darkLayer = L.tileLayer(APP_CONFIG.tiles.dark.url, {
    attribution: APP_CONFIG.tiles.dark.attribution,
    maxZoom: APP_CONFIG.tiles.dark.maxZoom,
    subdomains: APP_CONFIG.tiles.dark.subdomains,
  });

  satelliteLayer.addTo(map);
  labelsLayer.addTo(map);

  // ---- Zoom control (custom position, top-right) ----
  L.control.zoom({ position: "topright" }).addTo(map);

  // ---- Scale bar ----
  L.control.scale({ position: "bottomleft", imperial: false, maxWidth: 140 }).addTo(map);
  // Hide default leaflet scale — we render our own coord HUD; keep scale bar too but nudge via CSS margin
  const scaleEl = document.querySelector(".leaflet-control-scale");
  if (scaleEl) scaleEl.style.marginBottom = "56px";
  if (scaleEl) scaleEl.style.marginLeft = "150px";

  // ---- Coordinate HUD ----
  const coordValueEl = document.getElementById("coord-value");
  map.on("mousemove", (e) => {
    const lat = e.latlng.lat.toFixed(4);
    const lng = e.latlng.lng.toFixed(4);
    coordValueEl.textContent = `${Math.abs(lat)}°${lat >= 0 ? "N" : "S"}  ${Math.abs(lng)}°${lng >= 0 ? "E" : "W"}`;
  });

  // ---- Minimap ----
  initMinimap(map);

  return map;
}

function initMinimap(mainMap) {
  const minimap = L.map("minimap", {
    center: mainMap.getCenter(),
    zoom: Math.max(mainMap.getZoom() - 5, 3),
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false,
  });
  L.tileLayer(APP_CONFIG.tiles.dark.url, {
    subdomains: APP_CONFIG.tiles.dark.subdomains,
    maxZoom: 10,
  }).addTo(minimap);

  const viewportRect = L.rectangle(mainMap.getBounds(), {
    color: "#FF6B35",
    weight: 1.5,
    fillOpacity: 0.08,
  }).addTo(minimap);

  function syncMinimap() {
    viewportRect.setBounds(mainMap.getBounds());
    minimap.setView(mainMap.getCenter(), Math.max(mainMap.getZoom() - 5, 3), { animate: false });
  }
  mainMap.on("move zoom", syncMinimap);
  AppState.minimap = minimap;
}

function setBasemap(basemap) {
  const map = AppState.map;
  if (basemap === "satellite") {
    if (map.hasLayer(darkLayer)) map.removeLayer(darkLayer);
    if (!map.hasLayer(satelliteLayer)) satelliteLayer.addTo(map);
    if (AppState.labelsOn && !map.hasLayer(labelsLayer)) labelsLayer.addTo(map);
  } else {
    if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
    if (map.hasLayer(labelsLayer)) map.removeLayer(labelsLayer);
    if (!map.hasLayer(darkLayer)) darkLayer.addTo(map);
  }
  AppState.basemap = basemap;
}

function setLabelsVisible(on) {
  const map = AppState.map;
  AppState.labelsOn = on;
  if (AppState.basemap !== "satellite") return;
  if (on && !map.hasLayer(labelsLayer)) labelsLayer.addTo(map);
  if (!on && map.hasLayer(labelsLayer)) map.removeLayer(labelsLayer);
}

/* ---- Boot sequence ---- */
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  bootstrapData();
});

async function bootstrapData() {
  try {
    const [dataRes, linesRes, catsRes] = await Promise.all([
      fetch(APP_CONFIG.dataUrl),
      fetch(APP_CONFIG.tunnelLinesUrl),
      fetch(APP_CONFIG.categoriesUrl),
    ]);
    const dataJson = await dataRes.json();
    const linesJson = await linesRes.json();
    const catsJson = await catsRes.json();

    AppState.allFeatures = dataJson.features || [];
    AppState.tunnelLines = linesJson.features || [];
    AppState.categories = catsJson || [];
    AppState.categoryById = {};
    catsJson.forEach((c) => {
      AppState.categoryById[c.id] = c;
      AppState.visibleCategories.add(c.id);
    });

    buildSearchIndex();
    initLayers();
    initSidebar();
    initHud();
    initPopup();

    document.getElementById("loading-overlay").classList.add("hidden");
  } catch (err) {
    console.error("Failed to bootstrap intelligence data:", err);
    const loadingText = document.querySelector(".loading-text");
    if (loadingText) {
      loadingText.textContent = "DATA FEED ERROR — CHECK CONSOLE";
      loadingText.style.color = "#FF6459";
    }
  }
}
