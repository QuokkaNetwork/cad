const { Departments } = require('../db/sqlite');

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

function getDepartmentLeaderRoleConfig({ activeOnly = false } = {}) {
  const departments = activeOnly ? Departments.listActive() : Departments.list();
  const roleIdsByDepartmentId = new Map();
  const union = [];
  const seen = new Set();

  for (const dept of departments) {
    const departmentId = Number(dept?.id || 0);
    if (!departmentId) continue;
    const roleIds = parseDiscordRoleIds(dept?.department_leader_role_ids || '');
    roleIdsByDepartmentId.set(departmentId, roleIds);
    for (const roleId of roleIds) {
      if (seen.has(roleId)) continue;
      seen.add(roleId);
      union.push(roleId);
    }
  }

  return {
    departments,
    roleIdsByDepartmentId,
    unionRoleIds: union,
  };
}

async function getDepartmentLeaderScopeForUser(user, { activeOnly = false } = {}) {
  const config = getDepartmentLeaderRoleConfig({ activeOnly });
  const allDepartmentIds = config.departments
    .map((dept) => Number(dept?.id || 0))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (user?.is_admin) {
    return {
      allowed: true,
      source: 'admin',
      is_admin: true,
      is_department_leader: false,
      can_manage_all_departments: true,
      managed_department_ids: allDepartmentIds,
      matched_role_ids_by_department: {},
      configured_leader_role_ids: config.unionRoleIds,
    };
  }

  const discordId = String(user?.discord_id || '').trim();
  if (!discordId) {
    return {
      allowed: false,
      source: 'no_discord_link',
      is_admin: false,
      is_department_leader: false,
      can_manage_all_departments: false,
      managed_department_ids: [],
      matched_role_ids_by_department: {},
      configured_leader_role_ids: config.unionRoleIds,
    };
  }

  if (config.unionRoleIds.length === 0) {
    return {
      allowed: false,
      source: 'no_department_leader_roles_configured',
      is_admin: false,
      is_department_leader: false,
      can_manage_all_departments: false,
      managed_department_ids: [],
      matched_role_ids_by_department: {},
      configured_leader_role_ids: [],
    };
  }

  try {
    const { getGuildMemberRoleIds } = require('../discord/bot');
    if (typeof getGuildMemberRoleIds !== 'function') {
      return {
        allowed: false,
        source: 'discord_helper_unavailable',
        is_admin: false,
        is_department_leader: false,
        can_manage_all_departments: false,
        managed_department_ids: [],
        matched_role_ids_by_department: {},
        configured_leader_role_ids: config.unionRoleIds,
      };
    }

    const guildResult = await getGuildMemberRoleIds(discordId);
    if (!guildResult?.ok) {
      return {
        allowed: false,
        source: guildResult?.reason || 'member_lookup_failed',
        is_admin: false,
        is_department_leader: false,
        can_manage_all_departments: false,
        managed_department_ids: [],
        matched_role_ids_by_department: {},
        configured_leader_role_ids: config.unionRoleIds,
      };
    }

    const currentRoles = new Set((Array.isArray(guildResult.roleIds) ? guildResult.roleIds : []).map((id) => String(id)));
    const managedDepartmentIds = [];
    const matchedRoleIdsByDepartment = {};

    for (const dept of config.departments) {
      const departmentId = Number(dept?.id || 0);
      if (!departmentId) continue;
      const roleIds = config.roleIdsByDepartmentId.get(departmentId) || [];
      const matched = roleIds.find((roleId) => currentRoles.has(String(roleId)));
      if (!matched) continue;
      managedDepartmentIds.push(departmentId);
      matchedRoleIdsByDepartment[String(departmentId)] = matched;
    }

    return {
      allowed: managedDepartmentIds.length > 0,
      source: managedDepartmentIds.length > 0 ? 'department_leader_role' : 'role_not_present',
      is_admin: false,
      is_department_leader: managedDepartmentIds.length > 0,
      can_manage_all_departments: false,
      managed_department_ids: managedDepartmentIds,
      matched_role_ids_by_department: matchedRoleIdsByDepartment,
      configured_leader_role_ids: config.unionRoleIds,
    };
  } catch (err) {
    return {
      allowed: false,
      source: 'discord_check_failed',
      is_admin: false,
      is_department_leader: false,
      can_manage_all_departments: false,
      managed_department_ids: [],
      matched_role_ids_by_department: {},
      configured_leader_role_ids: config.unionRoleIds,
      error: String(err?.message || err || 'Discord permission check failed'),
    };
  }
}

function departmentLeaderScopeCanManageDepartment(scope, departmentId) {
  const targetId = Number(departmentId || 0);
  if (!Number.isInteger(targetId) || targetId <= 0) return false;
  if (!scope || typeof scope !== 'object') return false;
  if (scope.can_manage_all_departments) return true;
  const managed = Array.isArray(scope.managed_department_ids) ? scope.managed_department_ids : [];
  return managed.some((id) => Number(id) === targetId);
}

async function requireDepartmentApplicationManager(req, res, next) {
  const scope = await getDepartmentLeaderScopeForUser(req.user);
  req.departmentLeaderScope = scope;
  if (!scope.allowed) {
    return res.status(403).json({
      error: 'Department application management access required',
      reason: scope.source || 'forbidden',
    });
  }
  next();
}

module.exports = {
  parseDiscordRoleIds,
  getDepartmentLeaderRoleConfig,
  getDepartmentLeaderScopeForUser,
  departmentLeaderScopeCanManageDepartment,
  requireDepartmentApplicationManager,
};

