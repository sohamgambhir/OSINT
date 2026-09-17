# OSINT Geospatial Intelligence Dashboard

Static, zero-dependency satellite intelligence map of all 23 sheets in
`WTC Infrastructure.xlsx` (1,027 geolocated features across 21 categories,
plus 5 tunnel-portal lines).

## Run it

Open `index.html` directly in a browser (Chrome/Edge/Firefox). No server or
build step is required. An internet connection is needed for map tiles and
fonts (Esri World Imagery, CARTO dark basemap, Google Fonts, Leaflet — all
loaded from public CDNs, no API keys).

## Regenerate the data

If `WTC Infrastructure.xlsx` is updated, re-run the pipeline:

```
pip install openpyxl
python3 process_data.py
```

This reads the workbook (edit the `SRC` path at the top of the script if it
moves) and rewrites everything in `data/`:
`intelligence.geojson`, `tunnel_lines.geojson`, `categories.json`, and
`skipped_rows.log` (rows dropped for missing/invalid coordinates — 74 of
1,101 source rows, mostly section-header rows like "XMD"/"TMD" or entries
with genuinely no lat/long on record).

## Notes

- `Rly Route` and `Wx Mod` sheets carry no coordinate data and are excluded
  from the map, per plan.
- Coordinate parsing handles decimal degrees, DMS strings, degree-symbol
  suffixes, and uncertain ("?") or slash-alternate values.
- All UI, layer toggles, search, heatmap, and intelligence-card logic is
  vanilla JS (`js/`) — no build step, no framework.
