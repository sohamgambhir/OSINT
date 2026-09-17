/* ==========================================================================
   config.js — global app config, constants, and shared state
   ========================================================================== */

const APP_CONFIG = {
  dataUrl: "data/intelligence.geojson",
  tunnelLinesUrl: "data/tunnel_lines.geojson",
  categoriesUrl: "data/categories.json",

  initialView: { lat: 32.5, lng: 88.0, zoom: 6 },

  tiles: {
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, AeroGRID, IGN, GIS User Community",
      maxZoom: 19,
    },
    labels: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      attribution: "",
      maxZoom: 19,
    },
    dark: {
      // Keyless dark composite basemap (CARTO dark-matter, no API key required)
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      maxZoom: 19,
      subdomains: "abcd",
    },
  },

  threatColors: {
    HIGH: "#FF3B30",
    MEDIUM: "#FF9500",
    LOW: "#30D158",
  },

  clusterColorStops: [
    { max: 10, color: "#30D158" },
    { max: 40, color: "#FFCC00" },
    { max: Infinity, color: "#FF3B30" },
  ],
};

/* Shared mutable app state, populated as data loads */
const AppState = {
  allFeatures: [],          // raw GeoJSON features (points)
  tunnelLines: [],          // GeoJSON LineString features
  categories: [],           // categories.json array
  categoryById: {},         // id -> category config
  layerGroups: {},          // category id -> L.LayerGroup / markerClusterGroup
  visibleCategories: new Set(),
  activeThreats: new Set(["HIGH", "MEDIUM", "LOW"]),
  mode: "pins",             // 'pins' | 'heatmap'
  basemap: "satellite",     // 'satellite' | 'dark'
  labelsOn: true,
  tunnelLinesOn: true,
  map: null,
  minimap: null,
  heatLayer: null,
  tunnelLineLayer: null,
  selectedFeature: null,
  searchIndex: [],          // flattened searchable text per feature
};
