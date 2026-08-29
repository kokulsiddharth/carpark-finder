/** HDB Central Area car parks — official short-term table. */
export const CENTRAL_HDB = new Set([
  "ACB",
  "BBB",
  "BRB1",
  "CY",
  "DUXM",
  "HLM",
  "KAB",
  "KAM",
  "KAS",
  "PRM",
  "SLS",
  "SR1",
  "SR2",
  "TPM",
  "UCS",
  "WCB",
]);

/** Peak-hour surcharge parks. Hours are local (SGT). */
export const PEAK_HDB = {
  ACB: { label: "Weekdays 10:00am–6:00pm; weekends 8:00am–7:00pm", weekdays: [10, 18], weekend: [8, 19] },
  CY: { label: "Weekdays 10:00am–6:00pm; weekends 8:00am–7:00pm", weekdays: [10, 18], weekend: [8, 19] },
  SE21: { label: "Mon–Sat 10:00am–10:00pm", monSat: [10, 22] },
  SE22: { label: "Mon–Sat 10:00am–10:00pm", monSat: [10, 22] },
  SE24: { label: "Daily 10:00am–10:00pm", daily: [10, 22] },
  MP14: { label: "Daily 8:00am–8:00pm", daily: [8, 20] },
  MP15: { label: "Daily 8:00am–8:00pm", daily: [8, 20] },
  MP16: { label: "Daily 8:00am–8:00pm", daily: [8, 20] },
  HG9: { label: "Weekdays 11:00am–8:00pm; weekends 9:00am–8:00pm", weekdays: [11, 20], weekend: [9, 20] },
  HG9T: { label: "Weekdays 11:00am–8:00pm; weekends 9:00am–8:00pm", weekdays: [11, 20], weekend: [9, 20] },
  HG15: { label: "Weekdays 11:00am–8:00pm; weekends 9:00am–8:00pm", weekdays: [11, 20], weekend: [9, 20] },
  HG16: { label: "Weekdays 11:00am–8:00pm; weekends 9:00am–8:00pm", weekdays: [11, 20], weekend: [9, 20] },
};

function inHourRange(hour, range) {
  if (!range) return false;
  const [start, end] = range;
  return hour >= start && hour < end;
}

export function isPeakNow(carParkNo, date = new Date()) {
  const spec = PEAK_HDB[carParkNo];
  if (!spec) return false;
  const day = date.getDay(); // 0 Sun
  const hour = date.getHours();
  const isWeekend = day === 0 || day === 6;
  if (spec.daily) return inHourRange(hour, spec.daily);
  if (spec.monSat) return day >= 1 && day <= 6 && inHourRange(hour, spec.monSat);
  if (isWeekend) return inHourRange(hour, spec.weekend);
  if (day >= 1 && day <= 5) return inHourRange(hour, spec.weekdays);
  return false;
}

/**
 * Current car short-term rate per 30 minutes (HDB published table).
 * Central: $1.20 Mon–Sat 7am–5pm, else $0.60. Peak adds $0.20.
 */
export function currentHdbCarRate(park, date = new Date()) {
  if (park.shortTerm === "NO") {
    return { perHalfHour: null, label: "No short-term parking", detail: "Season parking only." };
  }
  const central = CENTRAL_HDB.has(park.id);
  const day = date.getDay();
  const hour = date.getHours() + date.getMinutes() / 60;
  const centralPeakWindow = day >= 1 && day <= 6 && hour >= 7 && hour < 17;
  let perHalfHour = central && centralPeakWindow ? 1.2 : 0.6;
  const peak = isPeakNow(park.id, date);
  if (peak) perHalfHour += 0.2;

  const bits = [];
  if (central) bits.push("Central Area");
  if (peak) bits.push("peak hour");
  const label = `$${perHalfHour.toFixed(2)} / 30 min`;
  const detail = bits.length ? bits.join(" · ") : "Outside Central Area";
  return { perHalfHour, label, detail, central, peak };
}

export function hdbRateCard(park) {
  const now = currentHdbCarRate(park);
  const central = CENTRAL_HDB.has(park.id);
  const peak = PEAK_HDB[park.id];
  const lines = [];

  if (park.shortTerm === "NO") {
    lines.push("Short-term parking is not offered here.");
  } else {
    if (central) {
      lines.push("Cars: $1.20 / 30 min, Mon–Sat 7:00am–5:00pm");
      lines.push("Cars: $0.60 / 30 min at all other times");
    } else {
      lines.push("Cars: $0.60 / 30 min");
    }
    if (peak) {
      const bump = central ? "$1.40 / $0.80" : "$0.80";
      lines.push(`Peak (${peak.label}): ${bump} / 30 min`);
    }
    lines.push("Motorcycles: $0.65 per lot");
    lines.push("Heavy vehicles: $1.20 / 30 min");
    if (park.nightParking === "YES" && !peak) {
      lines.push("Night cap: $5 (10:30pm–7:00am)");
      lines.push(central ? "Whole-day cap: $20" : "Whole-day cap: $12");
    } else if (peak) {
      lines.push("Daily/night caps do not apply during peak-hour schemes.");
    }
  }

  if (park.freeParking && park.freeParking !== "NO") {
    lines.push(`Free parking: ${park.freeParking}`);
  }

  return {
    now,
    lines,
    source:
      "HDB short-term charges (national table). Confirm signboards — peak lists can change.",
  };
}

export function mallRateLines(park) {
  const r = park.rates || {};
  const rows = [
    ["Weekdays", [r.weekdays1, r.weekdays2].filter((s) => s && s !== "-").join(" · ")],
    ["Saturday", r.saturday && r.saturday !== "-" ? r.saturday : ""],
    ["Sunday / PH", r.sundayPh && r.sundayPh !== "-" ? r.sundayPh : ""],
  ].filter(([, v]) => v);
  return {
    now: { perHalfHour: null, label: "See tariff", detail: park.category || "Mall / commercial" },
    lines: rows.map(([k, v]) => `${k}: ${v}`),
    source: "LTA Carpark Rates. Malls change prices — treat as a hint, not a quote.",
  };
}

export function rateFor(park) {
  return park.source === "hdb" ? hdbRateCard(park) : mallRateLines(park);
}
