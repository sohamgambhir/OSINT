#!/usr/bin/env python3
"""
OSINT Geospatial Intelligence Platform - Data Pipeline
Converts WTC Infrastructure.xlsx (23 sheets) into a single GeoJSON
FeatureCollection plus a categories.json legend config.

Design notes:
- Column access is by POSITIONAL INDEX (1-based) per sheet rather than by
  header name, because several sheets reuse header labels (e.g. two
  'Latitude'/'Longitude' pairs for tunnel portals, or blank headers for
  unnamed lat/long columns). This avoids silent mis-mapping.
- Coordinates are parsed defensively: plain floats, degree-symbol suffixed
  strings ("80.291667°"), trailing "?" uncertainty markers, slash-separated
  alternates ("89.5232/89.5663" -> first value), and DMS strings
  ("29-17-46.6" -> decimal degrees). Anything that still fails, or falls
  outside a sane bounding box for the theatre (lat 15-55N, lon 65-135E),
  is skipped and logged rather than silently dropped.
- Rows lacking usable coordinates (section header rows like "XMD"/"TMD",
  fully blank rows, or route/description-only sheets) are skipped, per the
  finalized implementation plan.
"""

import json
import re
import sys
from pathlib import Path

import openpyxl

SRC = "/mnt/user-data/uploads/OSINT_Geospatial/WTC Infrastructure.xlsx"
OUT_DIR = Path("/home/claude/osint_project/data")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Sane bounding box for the theatre of interest (greater China / South Asia
# border region). Anything outside this is almost certainly a data-entry
# error or mis-parsed value.
LAT_MIN, LAT_MAX = 14.0, 54.0
LON_MIN, LON_MAX = 64.0, 136.0

skipped_log = []


def parse_coord(value):
    """Best-effort parse of a coordinate cell into decimal degrees."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if not s:
        return None
    # DMS with degree/minute/second glyphs, e.g. 25°3'5.13″, 29°38'10, 37°49'47"
    if "°" in s:
        m = re.match(
            r"^\s*(\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)?\s*['’′\"]?\s*(\d+(?:\.\d+)?)?",
            s,
        )
        if m and m.group(1):
            d = float(m.group(1))
            mn = float(m.group(2)) if m.group(2) else 0.0
            sec = float(m.group(3)) if m.group(3) else 0.0
            return d + mn / 60.0 + sec / 3600.0

    s = s.replace("°", "").replace("?", "").strip()
    if not s:
        return None
    # Slash-separated alternates -> take the first
    if "/" in s:
        s = s.split("/")[0].strip()
    # DMS "DD-MM-SS(.s)"
    parts = s.split("-")
    if len(parts) == 3:
        try:
            d, m, sec = (float(p) for p in parts)
            return d + m / 60.0 + sec / 3600.0
        except ValueError:
            pass
    try:
        return float(s)
    except ValueError:
        pass
    m = re.search(r"-?\d+\.\d+|-?\d+", s)
    if m:
        try:
            return float(m.group())
        except ValueError:
            return None
    return None


def valid_latlon(lat, lon):
    if lat is None or lon is None:
        return False
    return LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX


def clean_header(h):
    if h is None:
        return None
    return str(h).strip()


def get_rows(ws):
    """Return (headers, data_rows) — data_rows skip fully blank rows."""
    max_col = ws.max_column
    headers = [clean_header(ws.cell(row=1, column=c).value) for c in range(1, max_col + 1)]
    rows = []
    for r in range(2, ws.max_row + 1):
        row = [ws.cell(row=r, column=c).value for c in range(1, max_col + 1)]
        if all(v is None or (isinstance(v, str) and not v.strip()) for v in row):
            continue
        rows.append((r, row))
    return headers, rows


def build_display_fields(headers, row, exclude_idx, sheet_name, row_num):
    """Turn remaining non-null columns into label/value pairs for the
    intelligence card, skipping columns already used for name/lat/lon."""
    fields = []
    seen_labels = {}
    for idx, val in enumerate(row):
        col = idx + 1
        if col in exclude_idx:
            continue
        if val is None:
            continue
        if isinstance(val, str) and not val.strip():
            continue
        label = headers[idx] if idx < len(headers) else None
        if not label:
            continue
        if isinstance(val, float) and val.is_integer():
            val = int(val)
        val_str = str(val).strip()
        if not val_str:
            continue
        # De-duplicate repeated header labels (e.g. multiple 'Unit' cols)
        if label in seen_labels:
            seen_labels[label] += 1
            label_out = f"{label} ({seen_labels[label]})"
        else:
            seen_labels[label] = 1
            label_out = label
        fields.append({"label": label_out, "value": val_str})
    return fields


# ---------------------------------------------------------------------------
# Per-sheet configuration
# ---------------------------------------------------------------------------
# category id -> {label, color, icon, threat, name_col, lat_col, lon_col}
# Column indices are 1-based and correspond to the sheet's raw columns.

CATEGORIES = {
    "Airbase": dict(label="Air Bases", color="#FF3B30", icon="airbase", threat="HIGH",
                     name_col=1, lat_col=9, lon_col=10),
    "SAM Site": dict(label="SAM Sites", color="#FF9500", icon="sam", threat="HIGH",
                      name_col=1, lat_col=3, lon_col=4),
    "Msl Base  Test Site": dict(label="Missile Bases / Test Sites", color="#FF2D55", icon="missile", threat="HIGH",
                                 name_col=2, lat_col=3, lon_col=4),
    "TMR Camps": dict(label="TMR Camps", color="#34C759", icon="camp", threat="MEDIUM",
                       name_col=1, lat_col=2, lon_col=3),
    "WTC Camps": dict(label="WTC Camps", color="#34C759", icon="camp", threat="MEDIUM",
                       name_col=1, lat_col=3, lon_col=4),
    "XMR Camps": dict(label="XMR Camps", color="#34C759", icon="camp", threat="MEDIUM",
                       name_col=1, lat_col=2, lon_col=3),
    "Central Camps": dict(label="Central Camps", color="#34C759", icon="camp", threat="MEDIUM",
                           name_col=1, lat_col=2, lon_col=3),
    "SIGINT": dict(label="SIGINT Facilities", color="#5856D6", icon="sigint", threat="HIGH",
                    name_col=1, lat_col=2, lon_col=3),
    "Svl": dict(label="Surveillance Sites", color="#BF5AF2", icon="surveillance", threat="MEDIUM",
                name_col=1, lat_col=2, lon_col=3),
    "Trg Area": dict(label="Training Areas", color="#30D158", icon="training", threat="LOW",
                      name_col=1, lat_col=2, lon_col=3),
    "Ammunition Storage": dict(label="Ammunition Storage", color="#FFCC00", icon="ammo", threat="HIGH",
                                name_col=1, lat_col=3, lon_col=4),
    "Logistics Area": dict(label="Logistics Areas", color="#FF6B35", icon="logistics", threat="MEDIUM",
                            name_col=1, lat_col=2, lon_col=3),
    "FOL": dict(label="Forward Ops / Fuel (FOL)", color="#FF6B35", icon="fol", threat="MEDIUM",
                name_col=1, lat_col=2, lon_col=3),
    "Power Stns": dict(label="Power Stations", color="#00D4FF", icon="power", threat="LOW",
                        name_col=1, lat_col=2, lon_col=3),
    "Railway Station": dict(label="Railway Stations", color="#00D4FF", icon="rail", threat="LOW",
                             name_col=1, lat_col=3, lon_col=4),
    "Railway Bridges": dict(label="Railway Bridges", color="#00D4FF", icon="bridge", threat="LOW",
                             name_col=1, lat_col=2, lon_col=3),
    "Balloon": dict(label="Airship / Balloon Sites", color="#64D2FF", icon="balloon", threat="MEDIUM",
                     name_col=1, lat_col=4, lon_col=5),
    "Dams": dict(label="Dams / Hydro", color="#00D4FF", icon="dam", threat="LOW",
                 name_col=1, lat_col=2, lon_col=3),
    "Satellite": dict(label="Satellite Facilities", color="#64D2FF", icon="satellite", threat="MEDIUM",
                       name_col=1, lat_col=3, lon_col=4),
    "Mfr": dict(label="Manufacturing", color="#FF453A", icon="factory", threat="HIGH",
                name_col=1, lat_col=3, lon_col=4),
    "TunnelsDugout": dict(label="Underground Facilities / Tunnels", color="#8E8E93", icon="tunnel", threat="MEDIUM",
                           name_col=1, lat_col=8, lon_col=9),
}

# Sheets intentionally excluded from point mapping (no usable lat/long data
# per the finalized plan): 'Rly Route' (line/time data only) and 'Wx Mod'
# (single entry, no coordinates). TunnelsDugout is handled specially below.

feature_id_counters = {}


def next_id(cat):
    feature_id_counters[cat] = feature_id_counters.get(cat, 0) + 1
    return f"{cat.strip().lower().replace(' ', '_')}_{feature_id_counters[cat]:03d}"


def make_point_feature(cat, name, lat, lon, display_fields, extra_props=None):
    cfg = CATEGORIES[cat]
    props = {
        "id": next_id(cat),
        "name": name or cfg["label"],
        "category": cat.strip(),
        "category_label": cfg["label"],
        "icon": cfg["icon"],
        "color": cfg["color"],
        "threat_level": cfg["threat"],
        "display_fields": display_fields,
    }
    if extra_props:
        props.update(extra_props)
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
        "properties": props,
    }


def process_standard_sheet(wb, sheet_name):
    ws = wb[sheet_name]
    cfg = CATEGORIES[sheet_name]
    headers, rows = get_rows(ws)
    features = []
    for row_num, row in rows:
        def col(i):
            return row[i - 1] if 0 < i <= len(row) else None

        name = col(cfg["name_col"])
        lat = parse_coord(col(cfg["lat_col"]))
        lon = parse_coord(col(cfg["lon_col"]))
        # Some sheets have Lat/Long swapped-looking values; sanity check.
        if lat is not None and lon is not None and not valid_latlon(lat, lon):
            # try swapped just in case
            if valid_latlon(lon, lat):
                lat, lon = lon, lat
            else:
                skipped_log.append(f"{sheet_name} row {row_num}: out-of-range coords lat={lat} lon={lon} name={name}")
                lat, lon = None, None
        if not valid_latlon(lat, lon):
            if name:  # only log real entries, not blank section rows
                skipped_log.append(f"{sheet_name} row {row_num}: no usable coords, name={name!r}")
            continue
        name_str = str(name).strip() if name else cfg["label"]
        exclude = {cfg["name_col"], cfg["lat_col"], cfg["lon_col"]}
        display_fields = build_display_fields(headers, row, exclude, sheet_name, row_num)
        features.append(make_point_feature(sheet_name, name_str, lat, lon, display_fields))
    return features


def process_tunnels(wb):
    """TunnelsDugout: main point at (Lat,Long) cols 8/9 when present,
    else fall back to Portal 1 coords. Also emits LineString features
    connecting Portal 1 -> Portal 2 when both exist."""
    ws = wb["TunnelsDugout"]
    headers, rows = get_rows(ws)
    point_features = []
    line_features = []
    for row_num, row in rows:
        def col(i):
            return row[i - 1] if 0 < i <= len(row) else None

        name = col(1)
        if not name:
            continue
        main_lat = parse_coord(col(8))
        main_lon = parse_coord(col(9))
        p1_lat = parse_coord(col(11))
        p1_lon = parse_coord(col(12))
        p2_lat = parse_coord(col(14))
        p2_lon = parse_coord(col(15))

        point_lat, point_lon = None, None
        if valid_latlon(main_lat, main_lon):
            point_lat, point_lon = main_lat, main_lon
        elif valid_latlon(p1_lat, p1_lon):
            point_lat, point_lon = p1_lat, p1_lon
        elif valid_latlon(p2_lat, p2_lon):
            point_lat, point_lon = p2_lat, p2_lon

        if point_lat is None:
            skipped_log.append(f"TunnelsDugout row {row_num}: no usable coords, name={name!r}")
            continue

        exclude = {1, 8, 9, 11, 12, 14, 15}
        display_fields = build_display_fields(headers, row, exclude, "TunnelsDugout", row_num)
        extra = {}
        if valid_latlon(p1_lat, p1_lon):
            extra["portal_1"] = {"label": str(col(10) or "Portal 1"), "lat": p1_lat, "lon": p1_lon}
        if valid_latlon(p2_lat, p2_lon):
            extra["portal_2"] = {"label": str(col(13) or "Portal 2"), "lat": p2_lat, "lon": p2_lon}
        point_features.append(
            make_point_feature("TunnelsDugout", str(name).strip(), point_lat, point_lon, display_fields, extra)
        )

        if valid_latlon(p1_lat, p1_lon) and valid_latlon(p2_lat, p2_lon):
            line_features.append({
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[round(p1_lon, 6), round(p1_lat, 6)], [round(p2_lon, 6), round(p2_lat, 6)]],
                },
                "properties": {
                    "id": next_id("TunnelPortalLine"),
                    "name": f"{str(name).strip()} — Tunnel Extent",
                    "category": "TunnelPortalLine",
                    "category_label": "Tunnel Portal Line",
                    "parent_name": str(name).strip(),
                    "color": CATEGORIES["TunnelsDugout"]["color"],
                },
            })
    return point_features, line_features


def process_railway_station(wb):
    """Railway Station: primary point at cols 3/4 (Lat/Long). When a row
    also has an RTP (Rail Transfer Point) coordinate at cols 12/13, emit
    that as a secondary linked point."""
    ws = wb["Railway Station"]
    cfg = CATEGORIES["Railway Station"]
    headers, rows = get_rows(ws)
    features = []
    for row_num, row in rows:
        def col(i):
            return row[i - 1] if 0 < i <= len(row) else None

        name = col(1)
        if not name:
            continue
        lat = parse_coord(col(3))
        lon = parse_coord(col(4))
        rtp_lat = parse_coord(col(12))
        rtp_lon = parse_coord(col(13))

        exclude = {1, 3, 4}
        if valid_latlon(lat, lon):
            display_fields = build_display_fields(headers, row, exclude | {12, 13}, "Railway Station", row_num)
            extra = {}
            if valid_latlon(rtp_lat, rtp_lon):
                extra["rtp"] = {"lat": rtp_lat, "lon": rtp_lon}
            features.append(make_point_feature("Railway Station", str(name).strip(), lat, lon, display_fields, extra))
        elif valid_latlon(rtp_lat, rtp_lon):
            # No main station coords, but an RTP point exists — map that instead.
            display_fields = build_display_fields(headers, row, exclude | {3, 4}, "Railway Station", row_num)
            features.append(make_point_feature(
                "Railway Station", f"{str(name).strip()} (RTP)", rtp_lat, rtp_lon, display_fields
            ))
        else:
            skipped_log.append(f"Railway Station row {row_num}: no usable coords, name={name!r}")
    return features


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True)

    all_point_features = []
    all_line_features = []

    for sheet_name in CATEGORIES:
        if sheet_name == "TunnelsDugout":
            continue
        if sheet_name == "Railway Station":
            continue
        if sheet_name not in wb.sheetnames:
            print(f"WARNING: sheet '{sheet_name}' not found in workbook", file=sys.stderr)
            continue
        feats = process_standard_sheet(wb, sheet_name)
        all_point_features.extend(feats)
        print(f"{sheet_name:25s} -> {len(feats):4d} features")

    tunnel_points, tunnel_lines = process_tunnels(wb)
    all_point_features.extend(tunnel_points)
    all_line_features.extend(tunnel_lines)
    print(f"{'TunnelsDugout':25s} -> {len(tunnel_points):4d} features ({len(tunnel_lines)} portal lines)")

    rail_feats = process_railway_station(wb)
    all_point_features.extend(rail_feats)
    print(f"{'Railway Station':25s} -> {len(rail_feats):4d} features")

    # Skipped sheets (no coordinate data)
    for skip_sheet in ("Rly Route", "Wx Mod"):
        if skip_sheet in wb.sheetnames:
            ws = wb[skip_sheet]
            n = max(0, ws.max_row - 1)
            print(f"{skip_sheet:25s} -> SKIPPED (no lat/long data, {n} rows)")

    geojson = {
        "type": "FeatureCollection",
        "features": all_point_features,
    }
    lines_geojson = {
        "type": "FeatureCollection",
        "features": all_line_features,
    }

    (OUT_DIR / "intelligence.geojson").write_text(json.dumps(geojson, ensure_ascii=False))
    (OUT_DIR / "tunnel_lines.geojson").write_text(json.dumps(lines_geojson, ensure_ascii=False))

    # categories.json — counts derived from actual output, not the plan doc
    counts = {}
    for f in all_point_features:
        cat = f["properties"]["category"]
        counts[cat] = counts.get(cat, 0) + 1

    categories_out = []
    for cat, cfg in CATEGORIES.items():
        cat_key = cat.strip()
        categories_out.append({
            "id": cat_key,
            "label": cfg["label"],
            "color": cfg["color"],
            "icon": cfg["icon"],
            "threat": cfg["threat"],
            "defaultVisible": True,
            "count": counts.get(cat_key, 0),
        })

    (OUT_DIR / "categories.json").write_text(json.dumps(categories_out, ensure_ascii=False, indent=2))

    print(f"\nTOTAL FEATURES: {len(all_point_features)}")
    print(f"TOTAL TUNNEL LINES: {len(all_line_features)}")
    print(f"SKIPPED (logged): {len(skipped_log)}")

    with open(OUT_DIR / "skipped_rows.log", "w") as f:
        f.write("\n".join(skipped_log))


if __name__ == "__main__":
    main()
