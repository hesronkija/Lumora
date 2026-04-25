export const ROLES = [
  'owner',
  'headteacher',
  'bursar',
  'accountant',
  'hr',
  'teacher',
  'class_teacher',
  'matron',
  'parent',
  'student',
  'nurse',
  'driver',
  'auditor',
] as const;

export type Role = (typeof ROLES)[number];

/** Roles that MUST have MFA (TOTP) enforced via Keycloak required action */
export const MFA_REQUIRED_ROLES: Role[] = ['owner', 'headteacher', 'bursar', 'accountant'];

/** Roles that have read-only access across the system */
export const READ_ONLY_ROLES: Role[] = ['auditor'];

export function hasRole(userRoles: string[], ...required: Role[]): boolean {
  return required.every((r) => userRoles.includes(r));
}

export function hasAnyRole(userRoles: string[], ...candidates: Role[]): boolean {
  return candidates.some((r) => userRoles.includes(r));
}
