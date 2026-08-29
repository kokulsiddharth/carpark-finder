import { rateFor } from "./rates.js";
import { svy21ToWgs84 } from "./svy21.js";

const RADIUS_DEFAULT = 800;
const SG_CENTER = [1.3521, 103.8198];

const state = {
  parks: [],
  availability: new Map(),
  origin: null,
  radius: RADIUS_DEFAULT,
  mallQuery: "",
  activeId: null,
  map: null,
  clusters: null,
  originMarker: null,
  markersById: new Map(),
};

function haversineM(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function occupancyClass(park) {
  const av = state.availability.get(park.id);
  if (!av || !av.total) return "";
  const free = av.available / av.total;
  if (av.available === 0) return "bad";
  if (free < 0.15) return "warn";
  return "good";
}

function occupancyLabel(park) {
  const av = state.availability.get(park.id);
  if (!av) return park.source === "hdb" ? "Lots: …" : "No live lots";
  if (!av.total) return "Lots: n/a";
  return `${av.available} / ${av.total} lots`;
}

function colourFor(park) {
  if (park.source === "mall") return "#3b3a78";
  const c = occupancyClass(park);
  if (c === "good") return "#1f7a45";
  if (c === "warn") return "#b45309";
  if (c === "bad") return "#b42318";
  return "#0f4c45";
}

function formatRateHtml(park) {
  const card = rateFor(park);
  const lines = card.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("");
  return `
    <div class="rate-now">${escapeHtml(card.now.label)}</div>
    <div class="addr">${escapeHtml(card.now.detail || "")}</div>
    <ul class="rate-lines">${lines}</ul>
    <p class="source">${escapeHtml(card.source)}</p>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function nearbyList() {
  const mallQ = state.mallQuery.trim().toLowerCase();
  const malls = mallQ
    ? state.parks
        .filter((p) => p.source === "mall" && `${p.name} ${p.address}`.toLowerCase().includes(mallQ))
        .slice(0, 20)
        .map((p) => ({ ...p, distance: null }))
    : [];
  const hdb = state.origin
    ? state.parks
        .filter((p) => p.source === "hdb" && p.lat != null && p.lng != null)
        .map((p) => ({ ...p, distance: haversineM(state.origin, p) }))
        .filter((p) => p.distance <= state.radius)
        .sort((a, b) => a.distance - b.distance)
    : [];
  return [...malls, ...hdb];
}

function renderResults() {
  const el = document.getElementById("results");
  const mallQ = state.mallQuery.trim();
  const list = nearbyList();
  if (!state.origin && !mallQ) {
    el.innerHTML = `<p class="addr">Enter a 6-digit postal code for nearby HDB carparks (live lots + rates), or search a mall name for LTA tariffs.</p>`;
    return;
  }
  if (!list.length) {
    el.innerHTML = mallQ
      ? `<p class="addr">No mall names matched. Try “Nex”, “Causeway Point”, “ION”.</p>`
      : `<p class="addr">Nothing within ${state.radius} m. Widen the radius or try another postal code.</p>`;
    return;
  }
  el.innerHTML = list
    .map((p) => {
      const occ = occupancyClass(p);
      const card = rateFor(p);
      return `
      <article class="card ${state.activeId === p.id ? "active" : ""}" data-id="${escapeHtml(p.id)}">
        <div class="card-top">
          <h2>${escapeHtml(p.source === "hdb" ? p.id : p.name)}</h2>
          <span class="dist">${p.distance == null ? "mall" : `${(p.distance / 1000).toFixed(2)} km`}</span>
        </div>
        <p class="addr">${escapeHtml(p.address)}</p>
        <div class="pills">
          <span class="pill ${p.source === "mall" ? "mall" : occ}">${escapeHtml(occupancyLabel(p))}</span>
          <span class="pill">${escapeHtml(card.now.label)}</span>
          ${p.shortTerm ? `<span class="pill">${escapeHtml(p.shortTerm)}</span>` : ""}
        </div>
        ${formatRateHtml(p)}
      </article>`;
    })
    .join("");

  el.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => focusPark(card.dataset.id));
  });
}

function focusPark(id) {
  state.activeId = id;
  const park = state.parks.find((p) => p.id === id);
  if (park?.lat != null) {
    state.map.setView([park.lat, park.lng], 17);
    const marker = state.markersById.get(id);
    if (marker) marker.openPopup();
  }
  renderResults();
}

function circleIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function popupHtml(park) {
  const card = rateFor(park);
  return `<strong>${escapeHtml(park.source === "hdb" ? park.id + " · " + park.address : park.name)}</strong>
    <div>${escapeHtml(occupancyLabel(park))}</div>
    <div>${escapeHtml(card.now.label)} ${escapeHtml(card.now.detail || "")}</div>`;
}

function rebuildMarkers() {
  state.clusters.clearLayers();
  state.markersById.clear();
  for (const p of state.parks) {
    if (p.lat == null || p.lng == null) continue;
    if (p.source !== "hdb") continue;
    const m = L.marker([p.lat, p.lng], { icon: circleIcon(colourFor(p)), title: p.name });
    m.bindPopup(popupHtml(p));
    m.on("click", () => {
      state.activeId = p.id;
      renderResults();
      document.querySelector(`[data-id="${CSS.escape(p.id)}"]`)?.scrollIntoView({ block: "nearest" });
    });
    state.clusters.addLayer(m);
    state.markersById.set(p.id, m);
  }
}

function setStatus(msg) {
  document.getElementById("status").textContent = msg || "";
}

async function geocodePostal(postal) {
  const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(postal)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Postal lookup failed");
  const json = await res.json();
  const hit = json.results?.[0];
  if (!hit?.LATITUDE) throw new Error("Postal code not found");
  return {
    lat: Number(hit.LATITUDE),
    lng: Number(hit.LONGITUDE),
    address: hit.ADDRESS,
  };
}

function setOrigin(origin) {
  state.origin = origin;
  if (state.originMarker) state.map.removeLayer(state.originMarker);
  if (state.searchCircle) state.map.removeLayer(state.searchCircle);
  state.originMarker = L.circleMarker([origin.lat, origin.lng], {
    radius: 8,
    color: "#c46a1a",
    fillColor: "#c46a1a",
    fillOpacity: 1,
    weight: 2,
  }).addTo(state.map);
  state.searchCircle = L.circle([origin.lat, origin.lng], {
    radius: state.radius,
    color: "#0f4c45",
    weight: 1.5,
    fillOpacity: 0.06,
  }).addTo(state.map);
  state.map.setView([origin.lat, origin.lng], 16);
  renderResults();
}

async function searchPostal() {
  const raw = document.getElementById("postal").value.replace(/\s/g, "");
  if (!/^\d{6}$/.test(raw)) {
    setStatus("Use a 6-digit Singapore postal code, e.g. 560123.");
    return;
  }
  setStatus("Looking up postal code…");
  try {
    const origin = await geocodePostal(raw);
    setStatus(origin.address);
    setOrigin(origin);
  } catch (err) {
    setStatus(err.message || "Could not look up that postal code.");
  }
}

async function loadAvailability() {
  try {
    const res = await fetch("https://api.data.gov.sg/v1/transport/carpark-availability");
    const json = await res.json();
    const rows = json.items?.[0]?.carpark_data ?? [];
    state.availability.clear();
    for (const row of rows) {
      let total = 0;
      let available = 0;
      for (const info of row.carpark_info ?? []) {
        total += Number(info.total_lots) || 0;
        available += Number(info.lots_available) || 0;
      }
      state.availability.set(row.carpark_number, {
        total,
        available,
        updated: row.update_datetime,
      });
    }
    rebuildMarkers();
    renderResults();
  } catch {
    /* live lots optional */
  }
}

async function boot() {
  document.getElementById("app").innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <h1>SG Carpark Map</h1>
        <p>HDB lots (live) and published rates. Mall tariffs from LTA — always check the gantry.</p>
      </div>
      <form class="search" id="search-form">
        <label for="postal">Postal code</label>
        <div class="search-row">
          <input id="postal" inputmode="numeric" maxlength="6" placeholder="e.g. 238801" autocomplete="postal-code" />
          <button type="submit">Find</button>
        </div>
      </form>
      <div class="search" style="padding-top:0">
        <label for="mall">Mall name (LTA rates)</label>
        <input id="mall" placeholder="e.g. Causeway Point" />
      </div>
      <div class="meta-row">
        <span>Radius <strong id="radius-label">${RADIUS_DEFAULT}</strong> m</span>
        <input id="radius" type="range" min="300" max="2000" step="100" value="${RADIUS_DEFAULT}" />
      </div>
      <div class="status" id="status"></div>
      <div class="results" id="results"></div>
    </aside>
    <div id="map"></div>
    <div class="legend">
      <div><span class="dot" style="background:#1f7a45"></span> HDB plenty of lots</div>
      <div><span class="dot" style="background:#b45309"></span> HDB filling up</div>
      <div><span class="dot" style="background:#b42318"></span> HDB full</div>
      <div><span class="dot" style="background:#c46a1a"></span> Your postal code</div>
    </div>
  `;

  state.map = L.map("map", { zoomControl: true }).setView(SG_CENTER, 12);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO · lots: data.gov.sg · rates: HDB / LTA',
    maxZoom: 19,
  }).addTo(state.map);

  state.clusters = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 48,
    spiderfyOnMaxZoom: true,
  });
  state.map.addLayer(state.clusters);

  const [hdbJson, ltaJson] = await Promise.all([
    fetch("./data/hdb-raw.json").then((r) => {
      if (!r.ok) throw new Error("Missing data/hdb-raw.json");
      return r.json();
    }),
    fetch("./data/lta-rates-raw.json").then((r) => {
      if (!r.ok) throw new Error("Missing data/lta-rates-raw.json");
      return r.json();
    }),
  ]);

  state.parks = [
    ...hdbJson.result.records.map((r) => {
      const { lat, lng } = svy21ToWgs84(Number(r.x_coord), Number(r.y_coord));
      return {
        id: r.car_park_no,
        source: "hdb",
        name: r.car_park_no,
        address: r.address,
        lat,
        lng,
        carParkType: r.car_park_type,
        parkingSystem: r.type_of_parking_system,
        shortTerm: r.short_term_parking,
        freeParking: r.free_parking,
        nightParking: r.night_parking,
        decks: Number(r.car_park_decks) || 0,
        gantryHeight: Number(r.gantry_height) || 0,
        basement: r.car_park_basement === "Y",
      };
    }),
    ...ltaJson.result.records.map((r) => ({
      id: `mall-${r._id}`,
      source: "mall",
      name: r.carpark,
      address: r.carpark,
      lat: null,
      lng: null,
      category: r.category,
      rates: {
        weekdays1: r.weekdays_rate_1 || "",
        weekdays2: r.weekdays_rate_2 || "",
        saturday: r.saturday_rate || "",
        sundayPh: r.sunday_publicholiday_rate || "",
      },
    })),
  ];
  rebuildMarkers();
  renderResults();

  document.getElementById("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    searchPostal();
  });
  document.getElementById("mall").addEventListener("input", (e) => {
    state.mallQuery = e.target.value;
    renderResults();
  });
  document.getElementById("radius").addEventListener("input", (e) => {
    state.radius = Number(e.target.value);
    document.getElementById("radius-label").textContent = String(state.radius);
    if (state.origin) setOrigin(state.origin);
  });

  loadAvailability();
  setInterval(loadAvailability, 60_000);
}

boot().catch((err) => {
  document.getElementById("app").textContent = err.message;
});
