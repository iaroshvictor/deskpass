/**
 * Who may do what.
 *
 * Kept free of Meteor so the decision is a pure function of "who is asking"
 * and "what they want" — see tests/unit/access-policy.test.mjs. The server
 * wrapper in imports/security/guards.ts loads the caller's role and turns a
 * denial into a Meteor.Error.
 *
 * Capabilities are deliberately finer-grained than the old model, where being
 * logged in was enough to unlock any door. A custom role grants nothing it was
 * not explicitly given; only the admin role is unconditional.
 */

export const PERMISSIONS = {
  /** Open a door through the access-control integration. */
  GATE_UNLOCK: 'gates.unlock',
  /** Read the gate inventory and its live state. */
  GATE_VIEW: 'gates.view',
  /** Change APACS / Telegram / DVR integration settings. */
  INTEGRATION_CONFIGURE: 'integrations.configure',
  /** Restart a camera pipeline or push keywords to it. */
  CAMERA_CONTROL: 'cams.control',
  /** Create, rename or delete zones. */
  ZONE_EDIT: 'zones.edit',
  /** Create operators and assign roles. */
  OPERATOR_MANAGE: 'operators.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | string;

export interface Caller {
  userId: string | null;
  /** 'admin', 'custom', or null for a caller with no role record. */
  role: string | null;
  /** Capabilities granted by the caller's role definition. */
  permissions?: string[];
}

export interface Verdict {
  allowed: boolean;
  /** Machine-readable denial code, mirrored into Meteor.Error. */
  reason?: 'not-authorized' | 'forbidden';
}

const ALLOWED: Verdict = { allowed: true };

/** True when the caller is a signed-in session rather than an anonymous socket. */
function isSignedIn(caller: unknown): caller is Caller {
  return (
    typeof caller === 'object' && caller !== null &&
    typeof (caller as Caller).userId === 'string' &&
    (caller as Caller).userId !== ''
  );
}

/**
 * Decide whether `caller` may exercise `permission`.
 *
 * Denial is the default: an unknown permission, a missing role and a malformed
 * caller all fail closed. Only the admin role short-circuits to allow.
 */
export function canAccess(caller: unknown, permission: Permission): Verdict {
  if (!isSignedIn(caller)) return { allowed: false, reason: 'not-authorized' };
  if (caller.role === 'admin') return ALLOWED;

  const granted = Array.isArray(caller.permissions) ? caller.permissions : [];
  if (granted.includes(permission)) return ALLOWED;

  return { allowed: false, reason: 'forbidden' };
}
