// timezone-regions.js
const moment = require("moment-timezone");

// Get ALL IANA timezone names
const allTimezones = moment.tz.names();

// Region classifier
function classify(iana) {
  if (iana.startsWith("Africa/")) return "Africa";

  if (iana.startsWith("America/Argentina")) return "South America";
  if (iana.startsWith("America/Brazil")) return "South America";

  if (iana.startsWith("America/")) {
    if (
      ["Mexico", "Costa", "Panama", "Guatemala", "El_Salvador"].some(c =>
        iana.includes(c)
      )
    ) {
      return "North America – Mexico/Central";
    }
    return "North America – US/Canada";
  }

  if (iana.startsWith("Asia/")) {
    if (
      ["Tokyo", "Seoul", "Shanghai", "Hong_Kong", "Taipei"].some(c =>
        iana.includes(c)
      )
    ) {
      return "Asia – East";
    }
    if (
      ["Kolkata", "Dhaka", "Kathmandu", "Colombo", "Karachi"].some(c =>
        iana.includes(c)
      )
    ) {
      return "Asia – South";
    }
    if (
      ["Bangkok", "Singapore", "Manila", "Jakarta", "Kuala_Lumpur"].some(c =>
        iana.includes(c)
      )
    ) {
      return "Asia – Southeast";
    }
    return "Asia – West / Middle East";
  }

  if (iana.startsWith("Australia/") || iana.startsWith("Pacific/"))
    return "Australia & Oceania";

  if (iana.startsWith("Europe/")) {
    if (["London", "Dublin", "Lisbon"].some(c => iana.includes(c)))
      return "Europe – West";
    if (
      ["Berlin", "Paris", "Rome", "Madrid", "Amsterdam", "Vienna"].some(c =>
        iana.includes(c)
      )
    )
      return "Europe – Central";
    return "Europe – East";
  }

  if (iana.startsWith("Atlantic/")) return "Atlantic Islands";
  if (iana.startsWith("Indian/")) return "Indian Ocean";
  if (iana.startsWith("Antarctica/")) return "Arctic/Antarctic";

  return "Etc/GMT";
}

// Build region → timezone list
const regions = {};

for (const iana of allTimezones) {
  const region = classify(iana);
  if (!regions[region]) regions[region] = [];

  const now = moment().tz(iana);

  regions[region].push({
    iana,
    label: iana.replace(/_/g, " "),
    offset: "UTC" + now.format("Z"), // DST-aware offset
    currentTime: now.format("h:mm A")
  });
}

module.exports = { regions };
