/* ==========================================================================
   hud.js — live clock + top HUD bar wiring
   ========================================================================== */

function initHud() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  const timeStr = now.toUTCString().split(" ")[4];
  setText("hud-date", dateStr);
  setText("hud-time", timeStr);
  setText("hud-tz", "UTC");
}
