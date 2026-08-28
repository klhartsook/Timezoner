const { timezoneData } = require("../timezone-definitions");

module.exports = (client) => {
    client.on("guildMemberUpdate", async (oldMember, newMember) => {

        // Detect newly added roles
        const addedRoles = newMember.roles.cache.filter(
            role => !oldMember.roles.cache.has(role.id)
        );

        // Build roleName → IANA timezone map
        const roleToIana = {};
        const allTimezoneRoleNames = [];

        for (const emoji of Object.keys(timezoneData)) {
            const offset = timezoneData[emoji].offset;   // e.g. "UTC+3"
            const iana = timezoneData[emoji].iana;       // e.g. "Asia/Tehran"

            roleToIana[offset] = iana;
            allTimezoneRoleNames.push(offset);
        }

        for (const role of addedRoles.values()) {

            // Ignore non-timezone roles
            if (!roleToIana[role.name]) continue;

            const newIana = roleToIana[role.name];

            // Remove old timezone roles
            for (const r of newMember.roles.cache.values()) {
                if (allTimezoneRoleNames.includes(r.name) && r.id !== role.id) {
                    await newMember.roles.remove(r).catch(() => {});
                }
            }

            // Save new timezone (IANA format)
            client.db.run(
                "INSERT OR REPLACE INTO timezones (user, tz) VALUES (?, ?)",
                [newMember.id, newIana],
                (err) => {
                    if (err) console.error("DB error:", err);
                }
            );
        }
    });
};
