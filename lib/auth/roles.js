// lib/auth/roles.js
//
// Role-based access: four roles, each a superset of the one before. A role
// decides both what a person can do and what they can see — operators run
// the floor without commercial figures; managers add penalties and exports;
// partners add the audit trail and model spend; admins manage access.
//
// The role comes from the signed-in user's app_metadata.role (set by an
// admin in Supabase, or synced from an Azure AD group claim). With no
// session — open access, as the app runs today — it is NEXUS_OPEN_ACCESS_ROLE.

export const ROLES = ['operator', 'manager', 'partner', 'admin'];

export const PERMISSIONS = {
  'view:operations': 'operator',      // dashboards, twin, incidents, predictive
  'act:acknowledge': 'operator',      // acknowledge alerts, declare SLA clock
  'run:simulation': 'operator',       // capacity and cascade what-ifs
  'use:copilot': 'operator',
  'view:commercial': 'manager',       // penalty amounts, contractual exposure
  'export:reports': 'manager',        // briefing and disclosure exports
  'view:audit': 'partner',            // audit trail
  'view:costs': 'partner',            // model spend per engagement
  'manage:access': 'admin',
};

const rank = (role) => ROLES.indexOf(role);

export function normaliseRole(role) {
  return ROLES.includes(role) ? role : 'operator';
}

/** Does `role` hold `permission`? Unknown permissions are denied. */
export function can(role, permission) {
  const needed = PERMISSIONS[permission];
  if (!needed) return false;
  return rank(normaliseRole(role)) >= rank(needed);
}

export function permissionsFor(role) {
  return Object.keys(PERMISSIONS).filter((p) => can(role, p));
}

/** Role for a Supabase user; least privilege when none is assigned. */
export function roleFromUser(user) {
  return normaliseRole(user?.app_metadata?.role ?? user?.user_metadata?.nexus_role);
}

export function openAccessRole() {
  return normaliseRole(process.env.NEXUS_OPEN_ACCESS_ROLE || 'manager');
}

export const authRequired = () => process.env.AUTH_REQUIRED === 'true';
