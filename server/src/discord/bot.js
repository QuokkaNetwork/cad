const { Client, GatewayIntentBits } = require('discord.js');
const config = require('../config');
const { Users, UserDepartments, DiscordRoleMappings } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');

let client = null;

async function startBot() {
  if (!config.discord.botToken) {
    console.warn('DISCORD_BOT_TOKEN not set - Discord bot disabled');
    return null;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.on('ready', () => {
    console.log(`Discord bot logged in as ${client.user.tag}`);
  });

  client.on('guildMemberUpdate', (oldMember, newMember) => {
    if (newMember.guild.id !== config.discord.guildId) return;

    const oldRoles = new Set(oldMember.roles.cache.map(r => r.id));
    const newRoles = new Set(newMember.roles.cache.map(r => r.id));

    // Check if roles actually changed
    if (oldRoles.size === newRoles.size && [...oldRoles].every(r => newRoles.has(r))) return;

    syncUserRoles(newMember.id).catch(err => {
      console.error('Role sync error for', newMember.id, err.message);
    });
  });

  await client.login(config.discord.botToken);
  return client;
}

async function syncUserRoles(discordId) {
  const user = Users.findByDiscordId(discordId);
  if (!user) return { synced: false, reason: 'User not linked' };

  if (!client) return { synced: false, reason: 'Bot not running' };

  const guild = client.guilds.cache.get(config.discord.guildId);
  if (!guild) return { synced: false, reason: 'Guild not found' };

  let member;
  try {
    member = await guild.members.fetch(discordId);
  } catch {
    return { synced: false, reason: 'Member not in guild' };
  }

  const mappings = DiscordRoleMappings.list();
  const memberRoleIds = new Set(member.roles.cache.map(r => r.id));

  const departmentIds = [];
  for (const mapping of mappings) {
    if (memberRoleIds.has(mapping.discord_role_id)) {
      departmentIds.push(mapping.department_id);
    }
  }

  // Deduplicate
  const uniqueDeptIds = [...new Set(departmentIds)];

  const oldDepts = UserDepartments.getForUser(user.id);
  UserDepartments.setForUser(user.id, uniqueDeptIds);
  const newDepts = UserDepartments.getForUser(user.id);

  // Check if anything changed
  const oldIds = oldDepts.map(d => d.id).sort().join(',');
  const newIds = newDepts.map(d => d.id).sort().join(',');
  if (oldIds !== newIds) {
    audit(user.id, 'department_sync', {
      discordId,
      before: oldDepts.map(d => d.short_name),
      after: newDepts.map(d => d.short_name),
    });
    bus.emit('sync:department', { userId: user.id, departments: newDepts });
  }

  return { synced: true, departments: newDepts.map(d => d.short_name) };
}

async function syncAllMembers() {
  if (!client) throw new Error('Bot not running');

  const guild = client.guilds.cache.get(config.discord.guildId);
  if (!guild) throw new Error('Guild not found');

  const members = await guild.members.fetch();
  const mappings = DiscordRoleMappings.list();
  let synced = 0;
  let skipped = 0;

  for (const [, member] of members) {
    const user = Users.findByDiscordId(member.id);
    if (!user) { skipped++; continue; }

    const memberRoleIds = new Set(member.roles.cache.map(r => r.id));
    const departmentIds = [];
    for (const mapping of mappings) {
      if (memberRoleIds.has(mapping.discord_role_id)) {
        departmentIds.push(mapping.department_id);
      }
    }

    UserDepartments.setForUser(user.id, [...new Set(departmentIds)]);
    synced++;
  }

  return { synced, skipped, total: members.size };
}

async function getGuildRoles() {
  if (!client) throw new Error('Bot not running');

  const guild = client.guilds.cache.get(config.discord.guildId);
  if (!guild) throw new Error('Guild not found');

  return guild.roles.cache
    .filter(r => r.id !== guild.id) // Exclude @everyone
    .sort((a, b) => b.position - a.position)
    .map(r => ({
      id: r.id,
      name: r.name,
      color: r.hexColor,
      position: r.position,
    }));
}

function getClient() {
  return client;
}

module.exports = { startBot, syncUserRoles, syncAllMembers, getGuildRoles, getClient };
