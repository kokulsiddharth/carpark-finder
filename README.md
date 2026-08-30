# SG Carpark Map

A browser-based tool for finding nearby carparks in Singapore with live lot availability and parking rates.

**Live site:** https://kokulsiddharth.github.io/carpark-finder/

---

## What it does

- **HDB carparks** — search by postal code to see all HDB carparks within a chosen radius (300 m – 2 km). Each carpark shows live lot availability (refreshed every 60 seconds from data.gov.sg) and the correct short-term rate for right now, including Central Area pricing and peak-hour surcharges.
- **Mall carparks** — search by mall name to look up LTA-published tariff rates (weekdays, Saturday, Sunday / public holidays).
- **Interactive map** — colour-coded markers show lot availability at a glance. Clusters thin out as you zoom in. Click a marker or a list card to focus on that carpark.

## How to use

1. **Find HDB carparks near you**
   - Type a 6-digit Singapore postal code into the **Postal code** field and press **Find**.
   - An orange pin appears at your location and a circle shows the search area.
   - Adjust the **Radius** slider (300 m – 2 km) to widen or narrow the search.
   - Each card shows available / total lots, the rate right now, and any free-parking or night-cap details.

2. **Look up a mall**
   - Type a mall name (e.g. `Nex`, `Causeway Point`, `ION`) into the **Mall name** field.
   - Matching malls appear instantly with their LTA weekday and weekend tariffs.
   - Treat these as a guide — confirm the rate at the gantry before parking.

3. **Read the map**

   | Colour | Meaning |
   |--------|---------|
   | Green | HDB carpark — plenty of lots available |
   | Orange | HDB carpark — filling up (< 15 % free) |
   | Red | HDB carpark — full |
   | Orange pin | Your searched postal code |

## Rate logic

### HDB carparks
Rates follow the official HDB short-term table:

| Location | Time | Cars |
|----------|------|------|
| Outside Central Area | All times | $0.60 / 30 min |
| Central Area | Mon–Sat 7:00 am–5:00 pm | $1.20 / 30 min |
| Central Area | All other times | $0.60 / 30 min |
| Peak-hour carparks | During peak window | +$0.20 / 30 min |

Motorcycles: $0.65 per lot · Heavy vehicles: $1.20 / 30 min  
Night cap (where applicable): $5 for 10:30 pm–7:00 am · Whole-day cap: $12 (non-central) / $20 (central)

### Mall carparks
Rates are sourced from the LTA Carpark Rates dataset. Malls set their own prices and change them without notice — always verify at the gantry.

## Data sources

| Data | Source |
|------|--------|
| HDB carpark locations & details | [data.gov.sg — HDB Carpark Information](https://data.gov.sg) |
| Live lot availability | [data.gov.sg — Carpark Availability API](https://data.gov.sg/datasets/d_9f8d88b1a383a14b5a4c6339c5748bf5/view) |
| Mall tariffs | [data.gov.sg — LTA Carpark Rates](https://data.gov.sg) |
| Map tiles | [CartoDB Voyager](https://carto.com/basemaps/) via OpenStreetMap |
| Postal code geocoding | [OneMap API](https://www.onemap.gov.sg/apidocs/) |

## Running locally

No build step required. Serve the project root with any static file server, e.g.:

```bash
npx serve .
```

Then open `http://localhost:3000` in your browser.

> The app uses ES modules (`type="module"`), so it must be served over HTTP — opening `index.html` directly as a `file://` URL will not work.
