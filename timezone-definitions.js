// timezone-definitions.js
const moment = require("moment-timezone");

// Get ALL IANA timezone names
const allTimezones = moment.tz.names();

// Build full DST-aware timezone objects
const timezoneData = allTimezones.map(iana => {
  const now = moment().tz(iana);

  return {
    iana,
    label: iana.replace("_", " "),
    offset: "UTC" + now.format("Z"), // DST-aware offset
    currentTime: now.format("h:mm A"),
    aliases: [] // optional, you can add custom aliases later
  };
});

module.exports = { timezoneData };
