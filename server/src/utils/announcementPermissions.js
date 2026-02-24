const { Settings } = require('../db/sqlite');

function parseDiscordRoleIds(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];

  const tokens = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      for (const item of parsed) tokens.push(String(item || ''));
    } else {
      tokens.push(text);
    }
  } catch {
    for (const line of text.split(/\r?\n/)) {
      tokens.push(line);
    }
  }

  const out = [];
  const seen = new Set();
  for (const token of tokens) {
    for (const part of String(token || '').split(/[,\s]+/)) {
      const cleaned = String(part || '')
        .trim()
        .replace(/^<@&/, '')
        .replace(/>$/, '');
      if (!/^\d{5,25}$/.test(cleaned)) continue;
      if (seen.has(cleaned)) continue;
      seen.add(cleaned);
      out.push(cleaned);
    }
  }
  return out;
}

function getDepartmentLeaderAnnouncementRoleIds() {
  return parseDiscordRoleIds(Settings.get('announcements_department_leader_role_ids') || '');
}

async function getAnnouncementPermissionForUser(user) {
  if (user?.is_admin) {
    return {
      allowed: true,
      source: 'admin',
      is_admin: true,
      is_department_leader: false,
      leader_role_ids: getDepartmentLeaderAnnouncementRoleIds(),
    };
  }

  const discordId = String(user?.discord_id || '').trim();
  const leaderRoleIds = getDepartmentLeaderAnnouncementRoleIds();
  if (!discordId) {
    return {
      allowed: false,
      source: 'no_discord_link',
      is_admin: false,
      is_department_leader: false,
      leader_role_ids: leaderRoleIds,
    };
  }
  if (leaderRoleIds.length === 0) {
    return {
      allowed: false,
      source: 'no_leader_roles_configured',
      is_admin: false,
      is_department_leader: false,
      leader_role_ids: leaderRoleIds,
    };
  }

  try {
    const { memberHasAnyGuildRole } = require('../discord/bot');
    if (typeof memberHasAnyGuildRole !== 'function') {
      return {
        allowed: false,
        source: 'discord_helper_unavailable',
        is_admin: false,
        is_department_leader: false,
        leader_role_ids: leaderRoleIds,
      };
    }
    const result = await memberHasAnyGuildRole(discordId, leaderRoleIds);
    return {
      allowed: !!result?.hasRole,
      source: result?.hasRole ? 'department_leader_role' : (result?.reason || 'role_not_present'),
      is_admin: false,
      is_department_leader: !!result?.hasRole,
      leader_role_ids: leaderRoleIds,
      matched_role_id: result?.matchedRoleId || '',
    };
  } catch (err) {
    return {
      allowed: false,
      source: 'discord_check_failed',
      is_admin: false,
      is_department_leader: false,
      leader_role_ids: leaderRoleIds,
      error: String(err?.message || err || 'Discord permission check failed'),
    };
  }
}

async function requireAnnouncementManager(req, res, next) {
  const permission = await getAnnouncementPermissionForUser(req.user);
  req.announcementPermission = permission;
  if (!permission.allowed) {
    return res.status(403).json({ error: 'Announcement management access required', reason: permission.source || 'forbidden' });
  }
  next();
}

module.exports = {
  parseDiscordRoleIds,
  getDepartmentLeaderAnnouncementRoleIds,
  getAnnouncementPermissionForUser,
  requireAnnouncementManager,
};

