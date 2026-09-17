/* ==========================================================================
   icons.js — custom military SVG icon factory, one glyph per category
   ========================================================================== */

const ICON_PATHS = {
  airbase: '<path d="M12 2 L14 9 L21 11 L14 12.5 L13 20 L12 23 L11 20 L10 12.5 L3 11 L10 9 Z"/>',
  sam: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="8" fill="none" stroke-width="1.6"/>',
  missile: '<path d="M12 2 C15 6 15 12 14 16 L10 16 C9 12 9 6 12 2 Z"/><path d="M10 16 L8 21 L10 19 L12 22 L14 19 L16 21 L14 16 Z"/>',
  camp: '<path d="M12 3 L21 19 H3 Z" fill-opacity="0.9"/><path d="M12 3 L12 19" stroke-width="1.2" stroke="#0006"/><rect x="9.3" y="15" width="5.4" height="4" fill="#0007"/>',
  sigint: '<path d="M12 21 V10" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7" r="3.2"/><path d="M6 13c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="none" stroke-width="1.6"/><path d="M3 16c0-5 4-9 9-9s9 4 9 9" fill="none" stroke-width="1.2" opacity="0.6"/>',
  surveillance: '<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="2.1" fill="#0009"/><path d="M2 12c2.5-5 7-8 10-8s7.5 3 10 8c-2.5 5-7 8-10 8s-7.5-3-10-8Z" fill="none" stroke-width="1.6"/>',
  training: '<circle cx="12" cy="12" r="9" fill="none" stroke-width="1.6"/><circle cx="12" cy="12" r="5.5" fill="none" stroke-width="1.6"/><circle cx="12" cy="12" r="2" />',
  ammo: '<rect x="8" y="3" width="8" height="6" rx="1"/><path d="M9 9h6l1.2 11a1 1 0 0 1-1 1.1H8.8a1 1 0 0 1-1-1.1L9 9Z"/>',
  logistics: '<rect x="3" y="8" width="13" height="9" rx="1"/><path d="M16 11h3.5L21 14v3h-5v-6Z"/><circle cx="7.5" cy="18.5" r="1.6"/><circle cx="17.5" cy="18.5" r="1.6"/>',
  fol: '<path d="M8 21h8" stroke-width="2" stroke-linecap="round"/><path d="M9 21V10a3 3 0 0 1 3-3 3 3 0 0 1 3 3v11" fill="none" stroke-width="2"/><path d="M15 8l2.5-2.5" stroke-width="2" stroke-linecap="round"/><circle cx="18.2" cy="4.3" r="1.4"/>',
  power: '<path d="M13 2 L4 14 H11 L9 22 L20 9 H13 Z"/>',
  rail: '<rect x="6" y="3" width="12" height="14" rx="5"/><path d="M6 11h12" stroke-width="1.6"/><circle cx="9" cy="20" r="1.4"/><circle cx="15" cy="20" r="1.4"/><path d="M8 17l-2 3M16 17l2 3" stroke-width="1.6" stroke-linecap="round"/>',
  bridge: '<path d="M2 16c2-5 5-8 10-8s8 3 10 8" fill="none" stroke-width="2"/><path d="M2 16h20M6 16v4M11 16v4M13 16v4M18 16v4" stroke-width="1.6" stroke-linecap="round"/>',
  balloon: '<ellipse cx="12" cy="9" rx="6.5" ry="7.5"/><path d="M9.5 16.2 L12 20 L14.5 16.2" fill="none" stroke-width="1.4"/><rect x="10.3" y="19.6" width="3.4" height="2.4" rx="0.5" fill="#0009"/>',
  dam: '<path d="M3 20V9l5-4 5 4v11" fill="none" stroke-width="1.8"/><path d="M13 20V13l4-3 4 3v7" fill="none" stroke-width="1.8"/><path d="M2 20h20" stroke-width="2" stroke-linecap="round"/>',
  satellite: '<rect x="9.5" y="9.5" width="5" height="5" rx="1" transform="rotate(45 12 12)"/><path d="M4 4l3.5 3.5M20 4l-3.5 3.5M4 20l3.5-3.5M20 20l-3.5-3.5" stroke-width="1.6" stroke-linecap="round"/>',
  factory: '<path d="M3 21V11l5 3v-3l5 3v-3l5 3v7H3Z"/><rect x="5" y="6" width="2.4" height="4" fill="#0009"/>',
  tunnel: '<path d="M3 20V12a9 9 0 0 1 18 0v8" fill="none" stroke-width="2"/><path d="M3 20h5M16 20h5" stroke-width="2" stroke-linecap="round"/><rect x="8" y="16" width="8" height="4" fill="#0008"/>',
  default: '<circle cx="12" cy="12" r="6"/>',
};

function buildDivIcon(category) {
  const color = category.color || "#00D4FF";
  const pathData = ICON_PATHS[category.icon] || ICON_PATHS.default;
  const html = `
    <div class="marker-pin" style="--pin-color:${color}">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="${color}" stroke="${color}">
        ${pathData}
      </svg>
    </div>`;
  return L.divIcon({
    html,
    className: "custom-div-icon",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

/* Inject the pin container style once (keeps icons.js self-contained) */
(function injectPinStyle() {
  const style = document.createElement("style");
  style.textContent = `
    .marker-pin {
      width: 26px; height: 26px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.16), rgba(10,12,16,0.92) 70%);
      border: 1.6px solid var(--pin-color);
      box-shadow: 0 0 10px -1px var(--pin-color), 0 2px 6px rgba(0,0,0,0.55);
    }
  `;
  document.head.appendChild(style);
})();

function iconForCluster(count) {
  let color = "#30D158";
  for (const stop of APP_CONFIG.clusterColorStops) {
    if (count <= stop.max) { color = stop.color; break; }
  }
  const size = count < 10 ? 34 : count < 40 ? 42 : count < 150 ? 50 : 58;
  return L.divIcon({
    html: `<div class="marker-cluster-blip" style="width:${size}px;height:${size}px;">
             <div style="background:${color}44; border-color:${color};">
               <span style="color:#fff;font-size:${size > 45 ? 14 : 12}px;">${count}</span>
             </div>
           </div>`,
    className: "",
    iconSize: L.point(size, size),
  });
}
