const timezoneEmojis = [
  "🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮",
  "🇯", "🇰", "🇱", "🇲", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🟦", "🔟",
  "🇳", "🇴", "🇵", "🇶", "🇷", "🇸", "🇹", "🇺", "🇻", "🇼", "🇽", "🇾", "🇿"
];

const timezoneData = {
  "🇦": { offset: "UTC-12", label: "Baker Island", iana: "Etc/GMT+12" },
  "🇧": { offset: "UTC-11", label: "American Samoa", iana: "Pacific/Pago_Pago" },
  "🇨": { offset: "UTC-10", label: "Hawaii", iana: "Pacific/Honolulu" },
  "🇩": { offset: "UTC+10", label: "Sydney", iana: "Australia/Sydney" },
  "🇪": { offset: "UTC+11", label: "Solomon Islands", iana: "Pacific/Guadalcanal" },
  "🇫": { offset: "UTC+12", label: "Auckland", iana: "Pacific/Auckland" },
  "🇬": { offset: "UTC+12:45", label: "Chatham Islands", iana: "Pacific/Chatham" },
  "🇭": { offset: "UTC+13", label: "Tonga", iana: "Pacific/Tongatapu" },
  "🇮": { offset: "UTC+14", label: "Kiritimati", iana: "Pacific/Kiritimati" },

  "🇯": { offset: "UTC-9", label: "Alaska", iana: "America/Anchorage" },
  "🇰": { offset: "UTC-8", label: "Los Angeles", iana: "America/Los_Angeles" },
  "🇱": { offset: "UTC-7", label: "Phoenix", iana: "America/Phoenix" },
  "🇲": { offset: "UTC-6", label: "Mexico City", iana: "America/Mexico_City" },
  "1️⃣": { offset: "UTC-5", label: "New York", iana: "America/New_York" },

  "2️⃣": { offset: "UTC-4", label: "Santiago", iana: "America/Santiago" },
  "3️⃣": { offset: "UTC-3", label: "São Paulo", iana: "America/Sao_Paulo" },
  "4️⃣": { offset: "UTC-2", label: "South Georgia", iana: "Atlantic/South_Georgia" },

  "5️⃣": { offset: "UTC-1", label: "Azores", iana: "Atlantic/Azores" },
  "6️⃣": { offset: "UTC+0", label: "London", iana: "Europe/London" },
  "7️⃣": { offset: "UTC+1", label: "Berlin", iana: "Europe/Berlin" },
  "8️⃣": { offset: "UTC+2", label: "Helsinki, Finland", iana: "Europe/Helsinki", aliases: ["Finland", "Helsinki", "Cairo", "Egypt"] },
  "9️⃣": { offset: "UTC+3", label: "Moscow", iana: "Europe/Moscow" },
  "🟦": { offset: "UTC+3:30", label: "Tehran", iana: "Asia/Tehran" },
  "🔟": { offset: "UTC+4", label: "Dubai", iana: "Asia/Dubai" },
  "🇳": { offset: "UTC+4:30", label: "Kabul", iana: "Asia/Kabul" },
  "🇴": { offset: "UTC+5", label: "Karachi", iana: "Asia/Karachi" },
  "🇵": { offset: "UTC+5:30", label: "New Delhi", iana: "Asia/Kolkata" },
  "🇶": { offset: "UTC+5:45", label: "Kathmandu", iana: "Asia/Kathmandu" },
  "🇷": { offset: "UTC+6", label: "Dhaka", iana: "Asia/Dhaka" },
  "🇸": { offset: "UTC+6:30", label: "Yangon", iana: "Asia/Yangon" },
  "🇹": { offset: "UTC+7", label: "Bangkok", iana: "Asia/Bangkok" },
  "🇺": { offset: "UTC+8", label: "Beijing", iana: "Asia/Shanghai" },
  "🇻": { offset: "UTC+8:30", label: "Pyongyang", iana: "Asia/Pyongyang" },
  "🇼": { offset: "UTC+9", label: "Tokyo", iana: "Asia/Tokyo" },
  "🇽": { offset: "UTC+8:45", label: "Eucla", iana: "Australia/Eucla" },
  "🇾": { offset: "UTC+9:30", label: "Adelaide", iana: "Australia/Adelaide" },
  "🇿": { offset: "UTC+10:30", label: "Lord Howe Island", iana: "Australia/Lord_Howe" }
};

const timezoneSections = {
  "🌎 Pacific & Oceania": ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮"],
  "🌍 North America": ["🇯", "🇰", "🇱", "🇲", "1️⃣"],
  "🌎 South America": ["2️⃣", "3️⃣", "4️⃣"],
  "🌍 Europe": ["5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"],
  "🌏 Middle East": ["🟦", "🔟", "🇳"],
  "🌏 South Asia": ["🇴", "🇵", "🇶"],
  "🌏 Southeast Asia": ["🇷", "🇸", "🇹"],
  "🌏 East Asia": ["🇺", "🇻", "🇼"],
  "🌏 Australia (Half‑Hour Zones)": ["🇽", "🇾", "🇿"]
};

module.exports = {
  timezoneEmojis,
  timezoneData,
  timezoneSections
};
