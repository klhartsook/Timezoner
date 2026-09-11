const { timezoneEmojis, timezoneData } = require("../timezone-definitions");

module.exports = (client) => {

    client.on("messageReactionAdd", async (reaction, user) => {
        try {
            // Ignore bot reactions
            if (user.bot) return;

            // Resolve partials
            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch {
                    return;
                }
            }

            const emoji = reaction.emoji.name;
            const message = reaction.message;
            const guild = message.guild;

            // Ignore DMs
            if (!guild) return;

            // --- Only process emojis that are part of the timezone system ---
            if (!timezoneEmojis.includes(emoji)) return;

            // --- Fetch all timezone panel messages from DB ---
            const rows = await new Promise((resolve, reject) => {
                client.db.all("SELECT id, channel FROM timezone_message", (err, r) => {
                    if (err) reject(err);
                    else resolve(r || []);
                });
            });

            // If this message is not one of the official timezone panels, ignore it
            const isPanelMessage = rows.some(row => row.id === message.id);
            if (!isPanelMessage) return;

            // --- Identify the timezone selected ---
            const tzInfo = timezoneData[emoji];
            if (!tzInfo) return;

            const newIana = tzInfo.iana;
            const newOffset = tzInfo.offset;

            const member = await guild.members.fetch(user.id);

            // --- Remove old timezone reactions across ALL panel messages ---
            for (const row of rows) {
                try {
                    const panelChannel = guild.channels.cache.get(row.channel);
                    if (!panelChannel) continue;

                    const panelMsg = await panelChannel.messages.fetch(row.id).catch(() => null);
                    if (!panelMsg) continue;

                    // Ensure all current reactions for this user are cleared from every other panel message.
                    // This also removes the same timezone emoji on a different panel, which is required
                    // when the user is switching between multiple timezone panels.
                    for (const reactionObj of panelMsg.reactions.cache.values()) {
                        const isCurrentReaction =
                            panelMsg.id === message.id &&
                            reactionObj.emoji.name === emoji;

                        if (isCurrentReaction) continue;

                        if (reactionObj.users.cache.has(user.id)) {
                            await reactionObj.users.remove(user.id).catch(() => {});
                        }
                    }
                } catch {
                    // Ignore failures on old messages
                }
            }

            // --- Remove old timezone roles ---
            const allTimezoneRoleNames = Object.values(timezoneData).map(t => t.offset);

            for (const role of member.roles.cache.values()) {
                if (allTimezoneRoleNames.includes(role.name)) {
                    await member.roles.remove(role).catch(() => {});
                }
            }

            // --- Assign the new timezone role ---
            let role = guild.roles.cache.find(r => r.name === newOffset);
            if (!role) {
                // Should not happen because setup command creates roles
                role = await guild.roles.create({
                    name: newOffset,
                    color: "Grey",
                    reason: "Timezone role auto-created"
                }).catch(() => null);
            }

            if (role) {
                await member.roles.add(role).catch(() => {});
            }

            // --- Save timezone to DB (IANA format) ---
            client.db.run(
                "INSERT OR REPLACE INTO timezones (user, tz) VALUES (?, ?)",
                [user.id, newIana],
                (err) => {
                    if (err) console.error("DB error:", err);
                }
            );

        } catch (err) {
            console.error("Timezone reaction error:", err);
        }
    });
};
