const { Client, GatewayIntentBits, Events } = require('discord.js');
const config = require('../config');
const { Users, UserDepartments, DiscordRoleMappings } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');

let client = null;
const ADMIN_DISCORD_ROLE_ID = '1472592662103064617';
let roleSyncInterval = null;

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

  client.on(Events.ClientReady, () => {
    console.log(`Discord bot logged in as ${client.user.tag}`);
  });

  client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
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
  startPeriodicRoleSync();
  return client;
}

function startPeriodicRoleSync() {
  const minutes = Number(config.discord.periodicSyncMinutes || 0);
  if (minutes <= 0) return;
  if (roleSyncInterval) return;

  syncAllMembers()
    .then(result => {
      console.log(`[Discord] Initial role sync complete: ${result.synced} synced, ${result.skipped} skipped`);
    })
    .catch(err => {
      console.error('[Discord] Initial role sync failed:', err.message);
    });

  const intervalMs = minutes * 60 * 1000;
  roleSyncInterval = setInterval(async () => {
    try {
      const result = await syncAllMembers();
      console.log(`[Discord] Periodic role sync complete: ${result.synced} synced, ${result.skipped} skipped`);
    } catch (err) {
      console.error('[Discord] Periodic role sync failed:', err.message);
    }
  }, intervalMs);

  console.log(`[Discord] Periodic role sync enabled every ${minutes} minute(s)`);
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
  const hasAdminRole = memberRoleIds.has(ADMIN_DISCORD_ROLE_ID);

  const departmentIds = [];
  for (const mapping of mappings) {
    if (memberRoleIds.has(mapping.discord_role_id)) {
      departmentIds.push(mapping.department_id);
    }
  }

  // Deduplicate
  const uniqueDeptIds = [...new Set(departmentIds)];

  const oldDepts = UserDepartments.getForUser(user.id);
  const oldIsAdmin = !!user.is_admin;
  UserDepartments.setForUser(user.id, uniqueDeptIds);
  if (hasAdminRole && !oldIsAdmin) {
    Users.update(user.id, { is_admin: 1 });
  }
  const newDepts = UserDepartments.getForUser(user.id);
  const newIsAdmin = !!(Users.findById(user.id)?.is_admin);

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

  if (oldIsAdmin !== newIsAdmin) {
    audit(user.id, 'admin_sync', {
      discordId,
      before: oldIsAdmin,
      after: newIsAdmin,
      roleId: ADMIN_DISCORD_ROLE_ID,
    });
  }

  return { synced: true, is_admin: newIsAdmin, departments: newDepts.map(d => d.short_name) };
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
    const hasAdminRole = memberRoleIds.has(ADMIN_DISCORD_ROLE_ID);
    const departmentIds = [];
    for (const mapping of mappings) {
      if (memberRoleIds.has(mapping.discord_role_id)) {
        departmentIds.push(mapping.department_id);
      }
    }

    UserDepartments.setForUser(user.id, [...new Set(departmentIds)]);
    if (hasAdminRole && !user.is_admin) {
      Users.update(user.id, { is_admin: 1 });
    }
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
