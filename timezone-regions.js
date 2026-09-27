// timezone-regions.js
const moment = require("moment-timezone");

const allTimezones = moment.tz.names();

// Improved region classifier with Asia sub-regions
function classify(iana) {
  if (iana.startsWith("America/")) return "Americas";
  if (iana.startsWith("Europe/")) return "Europe";
  if (iana.startsWith("Africa/")) return "Africa";
  if (iana.startsWith("Australia/") || iana.startsWith("Pacific/")) return "Oceania";

  if (iana.startsWith("Asia/")) {
    const city = iana.split("/")[1];

    // Asia West
    if ([
      "Dubai","Riyadh","Baghdad","Jerusalem","Amman","Beirut","Qatar","Bahrain",
      "Muscat","Tehran","Yerevan","Tbilisi"
    ].includes(city)) return "Asia West";

    // Asia Central
    if ([
      "Tashkent","Almaty","Bishkek","Dushanbe","Ashgabat"
    ].includes(city)) return "Asia Central";

    // Asia South
    if ([
      "Kolkata","Kathmandu","Colombo","Maldives","Karachi","Dhaka"
    ].includes(city)) return "Asia South";

    // Asia East
    if ([
      "Tokyo","Seoul","Shanghai","Taipei","Ulaanbaatar"
    ].includes(city)) return "Asia East";

    // Asia Southeast (default for remaining Asia)
    return "Asia Southeast";
  }

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
    currentHour: now.format("h"),
    currentPeriod: now.format("A"),
    currentTime: now.format("h:mm A")
  });
}

module.exports = { regions };