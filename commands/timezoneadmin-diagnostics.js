const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const { timezoneData } = require("../timezone-definitions");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("timezoneadmin-diagnostics")
        .setDescription("Shows a full self-diagnostic report for the timezone system.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option
                .setName("channel")
                .setDescription("Channel to evaluate for timezone permissions")
                .setRequired(true)
        ),

    async execute(interaction) {
        const db = interaction.client.db;
        const guild = interaction.guild;
        const botMember = guild.members.me;

        const targetChannel = interaction.options.getChannel("channel");

        // --- Ensure channel is text-based ---
        if (!targetChannel.isTextBased()) {
            return interaction.reply({
                content: "❌ The selected channel must be a text channel.",
                flags: MessageFlags.Ephemeral
            });
        }

        // --- CHECK CHANNEL PERMISSIONS ---
        const channelPerms = targetChannel.permissionsFor(botMember);
        const missingChannelPerms = [];

        const requiredChannelPerms = {
            "View Channel": PermissionFlagsBits.ViewChannel,
            "Send Messages": PermissionFlagsBits.SendMessages,
            "Add Reactions": PermissionFlagsBits.AddReactions,
            "Manage Messages": PermissionFlagsBits.ManageMessages,
            "Manage Roles": PermissionFlagsBits.ManageRoles
        };

        for (const [label, perm] of Object.entries(requiredChannelPerms)) {
            if (!channelPerms.has(perm)) missingChannelPerms.push(label);
        }

        // --- CHECK GUILD-LEVEL ROLE PERMISSION ---
        const hasManageRolesGuild = botMember.permissions.has(PermissionFlagsBits.ManageRoles);
        const hasManageRolesChannel = channelPerms.has(PermissionFlagsBits.ManageRoles);

        // --- CHECK ROLE HIERARCHY ---
        const timezoneRoleNames = Object.values(timezoneData).map(t => t.offset);
        const timezoneRoles = timezoneRoleNames
            .map(name => guild.roles.cache.find(r => r.name === name))
            .filter(Boolean);

        const canAssignAllTimezoneRoles = timezoneRoles.every(
            r => botMember.roles.highest.position > r.position
        );

        // --- CHECK ALLOWED ROLES + USERS ---
        const allowedRoles = [];
        const allowedUsers = [];

        await new Promise(resolve => {
            db.all("SELECT role_id FROM allowed_roles", (err, rows) => {
                if (!err && rows) {
                    for (const r of rows) {
                        if (r.role_id.startsWith("user:")) {
                            allowedUsers.push(r.role_id.replace("user:", ""));
                        } else {
                            allowedRoles.push(r.role_id);
                        }
                    }
                }
                resolve();
            });
        });

        // --- CHECK TIMEZONE PANEL STATUS ---
        const panelRows = await new Promise(resolve => {
            db.all("SELECT id, channel FROM timezone_message", (err, rows) => {
                resolve(rows || []);
            });
        });

        let foundPanels = 0;
        let missingPanels = 0;

        for (const row of panelRows) {
            const ch = guild.channels.cache.get(row.channel);
            if (!ch || !ch.isTextBased()) {
                missingPanels++;
                continue;
            }

            try {
                const msg = await ch.messages.fetch(row.id);
                if (msg) foundPanels++;
            } catch {
                missingPanels++;
            }
        }

        let panelStatus = "❌ No timezone panel found.";
        if (panelRows.length > 0) {
            if (foundPanels === panelRows.length) {
                panelStatus = "✅ All timezone panel messages are active.";
            } else if (foundPanels > 0) {
                panelStatus = `⚠️ Some timezone panel messages are missing (${missingPanels} missing).`;
            } else {
                panelStatus = "⚠️ Panel records exist, but none of the messages were found.";
            }
        }

        // --- REACTION LISTENER STATUS ---
        const reactionListenerStatus =
            channelPerms.has(PermissionFlagsBits.AddReactions) &&
            channelPerms.has(PermissionFlagsBits.ManageMessages)
                ? "✅ Reaction listener can operate normally."
                : "❌ Reaction listener may not function due to missing permissions.";

        // --- ROLE ASSIGNMENT STATUS ---
        let roleAssignmentStatus = "";

        if (!hasManageRolesGuild) {
            roleAssignmentStatus = "❌ Bot does NOT have ManageRoles permission at the guild level.";
        } else if (!hasManageRolesChannel) {
            roleAssignmentStatus = "❌ Bot cannot manage roles in this channel due to channel-level permission overrides.";
        } else if (!canAssignAllTimezoneRoles) {
            roleAssignmentStatus =
                "⚠️ Bot has ManageRoles, but its highest role is not above all timezone roles.";
        } else {
            roleAssignmentStatus = "✅ Bot can assign timezone roles.";
        }

        // --- BUILD EMBED ---
        const embed = new EmbedBuilder()
            .setTitle("🛠️ Timezone System Diagnostics")
            .setColor("#00AEEF")
            .addFields(
                {
                    name: "Evaluated Channel",
                    value: `• <#${targetChannel.id}>`,
                    inline: false
                },
                {
                    name: "Channel Permissions",
                    value:
                        missingChannelPerms.length === 0
                            ? "✅ All required channel permissions are present."
                            : "❌ Missing channel permissions:\n" +
                              missingChannelPerms.map(p => `• ${p}`).join("\n"),
                    inline: false
                },
                {
                    name: "Guild Role Permission",
                    value: hasManageRolesGuild
                        ? "✅ Bot has ManageRoles permission."
                        : "❌ Bot does NOT have ManageRoles permission.",
                    inline: false
                },
                {
                    name: "Role Assignment Status",
                    value: roleAssignmentStatus,
                    inline: false
                },
                {
                    name: "Allowed Roles",
                    value:
                        allowedRoles.length === 0
                            ? "No allowed roles."
                            : allowedRoles
                                  .map(id => {
                                      const role = guild.roles.cache.get(id);
                                      return role ? `• ${role.name}` : `• (deleted role: ${id})`;
                                  })
                                  .join("\n"),
                    inline: false
                },
                {
                    name: "Allowed Users",
                    value:
                        allowedUsers.length === 0
                            ? "No allowed users."
                            : allowedUsers
                                  .map(id => {
                                      const user = guild.members.cache.get(id);
                                      return user ? `• ${user.user.username}` : `• (user left server: ${id})`;
                                  })
                                  .join("\n"),
                    inline: false
                },
                {
                    name: "Timezone Panel",
                    value: panelStatus,
                    inline: false
                },
                {
                    name: "Reaction Listener Status",
                    value: reactionListenerStatus,
                    inline: false
                }
            )
            .setFooter({ text: "Timezone System Self-Diagnostic" });

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};
