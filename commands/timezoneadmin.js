const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("timezoneadmin")
        .setDescription("Manage who can run timezone setup commands.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub
                .setName("addrole")
                .setDescription("Allow a role to use timezone setup commands.")
                .addRoleOption(opt =>
                    opt.setName("role").setDescription("Role to allow").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("removerole")
                .setDescription("Remove a role from allowed timezone setup roles.")
                .addRoleOption(opt =>
                    opt.setName("role").setDescription("Role to remove").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("adduser")
                .setDescription("Allow a specific user to run timezone setup commands.")
                .addUserOption(opt =>
                    opt.setName("user").setDescription("User to allow").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("removeuser")
                .setDescription("Remove a user from timezone setup permissions.")
                .addUserOption(opt =>
                    opt.setName("user").setDescription("User to remove").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("list")
                .setDescription("Show all roles and users allowed to run timezone setup.")
        )
        .addSubcommand(sub =>
            sub
                .setName("resetpanel")
                .setDescription("Remove the stored timezone setup panel message and clear the panel record.")
        ),

    async execute(interaction) {
        const db = interaction.client.db;
        const sub = interaction.options.getSubcommand();

        // --- Permission check (same as setup-timezone-message) ---
        const rows = await new Promise((resolve, reject) => {
            db.all("SELECT role_id FROM allowed_roles", (err, r) => {
                if (err) return reject(err);
                resolve(r || []);
            });
        });

        const allowedRoleIds = rows.filter(r => !r.role_id.startsWith("user:")).map(r => r.role_id);
        const allowedUserIds = rows.filter(r => r.role_id.startsWith("user:")).map(r => r.role_id.replace("user:", ""));

        const member = interaction.member;
        const isDefaultAdmin =
            interaction.guild.ownerId === member.id ||
            member.permissions?.has(PermissionFlagsBits.Administrator);

        const userIsAllowed =
            isDefaultAdmin ||
            allowedUserIds.includes(member.id) ||
            member.roles.cache.some(role => allowedRoleIds.includes(role.id));

        if (!userIsAllowed) {
            return interaction.reply({
                content: "❌ You are not allowed to run timezone admin commands. Server owners and users with the Administrator permission can manage these settings by default.",
                flags: MessageFlags.Ephemeral
            });
        }

        // --- ADD ROLE ---
        if (sub === "addrole") {
            const role = interaction.options.getRole("role");

            db.run("INSERT OR IGNORE INTO allowed_roles (role_id) VALUES (?)", [role.id]);

            return interaction.reply({
                content: `✅ **${role.name}** can now run timezone setup commands.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // --- REMOVE ROLE ---
        if (sub === "removerole") {
            const role = interaction.options.getRole("role");

            db.run("DELETE FROM allowed_roles WHERE role_id = ?", [role.id]);

            return interaction.reply({
                content: `🗑️ **${role.name}** has been removed from timezone setup permissions.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // --- ADD USER ---
        if (sub === "adduser") {
            const user = interaction.options.getUser("user");

            db.run("INSERT OR IGNORE INTO allowed_roles (role_id) VALUES (?)", [`user:${user.id}`]);

            return interaction.reply({
                content: `✅ **${user.username}** can now run timezone setup commands.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // --- REMOVE USER ---
        if (sub === "removeuser") {
            const user = interaction.options.getUser("user");

            db.run("DELETE FROM allowed_roles WHERE role_id = ?", [`user:${user.id}`]);

            return interaction.reply({
                content: `🗑️ **${user.username}** has been removed from timezone setup permissions.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // --- RESET PANEL ---
        if (sub === "resetpanel") {
            try {
                const rows = await new Promise((resolve, reject) => {
                    db.all("SELECT id, channel FROM timezone_message", (err, results) => {
                        if (err) return reject(err);
                        resolve(results || []);
                    });
                });

                let removedMessages = 0;

                for (const row of rows) {
                    const channel = await interaction.guild.channels.fetch(row.channel).catch(() => null);
                    if (!channel || !channel.isTextBased()) continue;

                    const msg = await channel.messages.fetch(row.id).catch(() => null);
                    if (msg) {
                        await msg.delete().catch(() => {});
                        removedMessages++;
                    }
                }

                await new Promise((resolve, reject) => {
                    db.run("DELETE FROM timezone_message", (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });

                if (rows.length === 0) {
                    return interaction.reply({
                        content: "ℹ️ No stored timezone panel records were found.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (removedMessages > 0) {
                    return interaction.reply({
                        content: `🗑️ ${removedMessages} timezone panel message(s) were removed and records cleared.`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                return interaction.reply({
                    content: "🗑️ Panel records cleared. Messages were already gone or inaccessible.",
                    flags: MessageFlags.Ephemeral
                });

            } catch (err) {
                console.error("Failed to reset timezone panel:", err);
                return interaction.reply({
                    content: "❌ Failed to reset the timezone setup panel.",
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // --- LIST ALL ---
        if (sub === "list") {
            db.all("SELECT role_id FROM allowed_roles", async (err, rows) => {
                if (err) {
                    return interaction.reply({
                        content: "❌ Database error.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (rows.length === 0) {
                    return interaction.reply({
                        content: "No roles or users are currently allowed.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                let output = "**Allowed to run timezone setup:**\n\n";

                for (const entry of rows) {
                    if (entry.role_id.startsWith("user:")) {
                        const userId = entry.role_id.replace("user:", "");
                        const user = await interaction.guild.members.fetch(userId).catch(() => null);
                        output += `👤 User: ${user ? user.user.username : "(user left server)"}\n`;
                    } else {
                        const role = interaction.guild.roles.cache.get(entry.role_id);
                        output += `🔧 Role: ${role ? role.name : "(deleted role)"}\n`;
                    }
                }

                return interaction.reply({
                    content: output,
                    flags: MessageFlags.Ephemeral
                });
            });
        }
    }
};
