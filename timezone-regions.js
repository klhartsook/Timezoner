// timezone-regions.js
const moment = require("moment-timezone");

const allTimezones = moment.tz.names();

// Minimal region classifier
function classify(iana) {
  if (iana.startsWith("America/")) return "Americas";
  if (iana.startsWith("Europe/")) return "Europe";
  if (iana.startsWith("Asia/")) return "Asia";
  if (iana.startsWith("Australia/") || iana.startsWith("Pacific/")) return "Oceania";
  if (iana.startsWith("Africa/")) return "Africa";
  return "Others";
}

const regions = {};

for (const iana of allTimezones) {
  const region = classify(iana);
  if (!regions[region]) regions[region] = [];

  const now = moment().tz(iana);

  regions[region].push({
    region,
    iana,
    label: iana.replace(/_/g, " "),
    offset: "UTC" + now.format("Z"),
    currentHour: now.format("h"),      // "2"
    currentPeriod: now.format("A"),    // "PM"
    currentTime: now.format("h:mm A")  // "2:15 PM"
  });
}

module.exports = { regions };
