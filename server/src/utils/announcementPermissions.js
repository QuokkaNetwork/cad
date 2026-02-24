const { Settings } = require('../db/sqlite');
const {
  parseDiscordRoleIds,
  getDepartmentLeaderRoleConfig,
  getDepartmentLeaderScopeForUser,
} = require('./departmentLeaderPermissions');

function getDepartmentLeaderAnnouncementRoleIds() {
  const perDepartment = getDepartmentLeaderRoleConfig();
  if (Array.isArray(perDepartment?.unionRoleIds) && perDepartment.unionRoleIds.length > 0) {
    return perDepartment.unionRoleIds;
  }
  // Legacy fallback for existing deployments still using the old global setting.
  return parseDiscordRoleIds(Settings.get('announcements_department_leader_role_ids') || '');
}

async function getAnnouncementPermissionForUser(user, options = {}) {
  if (user?.is_admin) {
    return {
      allowed: true,
      source: 'admin',
      is_admin: true,
      is_department_leader: false,
      leader_role_ids: getDepartmentLeaderAnnouncementRoleIds(),
    };
  }

  const leaderRoleIds = getDepartmentLeaderAnnouncementRoleIds();
  const scope = options.departmentLeaderScope || await getDepartmentLeaderScopeForUser(user);
  if (Array.isArray(scope?.configured_leader_role_ids) && scope.configured_leader_role_ids.length > 0) {
    return {
      allowed: !!scope.allowed,
      source: scope.source || (scope.allowed ? 'department_leader_role' : 'role_not_present'),
      is_admin: false,
      is_department_leader: !!scope.is_department_leader,
      leader_role_ids: leaderRoleIds,
      managed_department_ids: Array.isArray(scope.managed_department_ids) ? scope.managed_department_ids : [],
      matched_role_id: Object.values(scope.matched_role_ids_by_department || {})[0] || '',
      matched_role_ids_by_department: scope.matched_role_ids_by_department || {},
      ...(scope.error ? { error: scope.error } : {}),
    };
  }
  const discordId = String(user?.discord_id || '').trim();
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
