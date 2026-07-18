import { AuthoritativeAccessSnapshot, rolesFromAccessSnapshot } from './access-snapshot'
import { normalizeAppRoles } from './roles'
import { type AccessCapability, hasAccessCapability } from './capabilities'

export type AppWorkspace = 'staff' | 'family' | 'none'
export type AppHomePath = '/today' | '/family' | '/settings' | '/access'

export interface AccessContext {
  roles: string[]
  surface: 'admin' | 'staff' | 'family' | 'none'
  isAdmin: boolean
  isStaff: boolean
  isClientSelf: boolean
  isExternal: boolean
  workspace: AppWorkspace
  homePath: AppHomePath
  capabilities: AccessCapability[]
}

export type AccessDestination =
  | '/login'
  | '/today'
  | '/family'
  | '/settings'
  | '/access/no-membership'
  | '/access/disabled'
  | '/access/pending'
  | '/access/setup'
  | '/access/feature-not-enabled'
  | '/access/unavailable'

export type RouteDecision =
  | { action: 'allow' }
  | { action: 'redirect'; destination: AccessDestination }

const ADMIN_ONLY_PATHS = [
  /^\/admin(?:\/|$)/,
  /^\/dashboard(?:\/|$)/,
  /^\/activity(?:\/|$)/,
  /^\/management(?:\/|$)/,
  /^\/staff(?:\/|$)/,
  /^\/evidence(?:\/|$)/,
  /^\/reports(?:\/|$)/,
  /^\/clients\/new$/,
  /^\/people\/new$/,
  /^\/visits\/new$/,
  /^\/schedule\/new$/,
  /^\/clients\/[^/]+\/edit$/,
]
const FRONTLINE_PATHS = [
  /^\/today$/,
  /^\/visits(?:\/[^/]+)?$/,
  /^\/schedule\/[^/]+$/,
  /^\/shift(?:\/|$)/,
  /^\/settings(?:\/|$)/,
  /^\/clients\/[^/]+$/,
]
const FAMILY_PATH = /^\/family(?:\/|$)/
const SETTINGS_PATH = /^\/settings(?:\/|$)/
const ACCESS_STATE_PATH = /^\/access\/(?:no-membership|disabled|pending|setup|feature-not-enabled|unavailable)$/
const MEDICATION_EMAR_PATH = /^\/(?:medication|emar)(?:\/|$)/
const AUTHORITATIVE_ROUTE_BYPASS_PATHS = [
  /^\/offline(?:\/|$)/,
  /^\/request-access(?:\/|$)/,
  /^\/accept-invitation(?:\/|$)/,
  /^\/activate-invitation(?:\/|$)/,
  /^\/platform(?:\/|$)/,
]

export function shouldBypassAuthoritativeRoute(pathname: string): boolean {
  return AUTHORITATIVE_ROUTE_BYPASS_PATHS.some((pattern) =>
    pattern.test(pathname),
  )
}

export function resolveProtectedRoute(
  pathname: string,
  authenticated: boolean,
  rawRoles: unknown,
  capabilities: readonly AccessCapability[] = [],
): RouteDecision {
  if (!authenticated) return { action: 'redirect', destination: '/login' }
  return resolveAuthenticatedRoute(pathname, rawRoles, capabilities)
}

export function getAccessContext(
  rawRoles: unknown,
  rawCapabilities: readonly AccessCapability[] = [],
): AccessContext {
  const roles = normalizeAppRoles(rawRoles)
  const capabilities = Array.from(new Set(rawCapabilities))
  const isAdmin = roles.includes('admin')
  const isRestrictedManagement =
    !isAdmin &&
    roles.some((role) => ['manager', 'care_manager', 'office'].includes(role)) &&
    !hasAccessCapability(capabilities, 'FRONTLINE_ASSIGNED_VISITS_VIEW')
  const isStaff = isAdmin || roles.includes('carer')
  const isClientSelf = roles.includes('client')
  const isExternal = roles.length > 0 && !isStaff
  const workspace: AppWorkspace = isStaff ? 'staff' : isExternal ? 'family' : 'none'
  const surface = isAdmin ? 'admin' : isStaff ? 'staff' : isExternal ? 'family' : 'none'

  return {
    roles,
    surface,
    isAdmin,
    isStaff,
    isClientSelf,
    isExternal,
    workspace,
    homePath: isRestrictedManagement
      ? '/settings'
      : isStaff
        ? '/today'
        : isExternal
          ? '/family'
          : '/access',
    capabilities,
  }
}

export function getAccessContextFromSnapshot(snapshot: AuthoritativeAccessSnapshot): AccessContext {
  return getAccessContext(rolesFromAccessSnapshot(snapshot), snapshot.capabilities)
}

export function resolveAuthoritativeRoute(
  pathname: string,
  snapshot: AuthoritativeAccessSnapshot,
): RouteDecision {
  if (!snapshot.authenticated || snapshot.resolution === 'UNAUTHENTICATED') {
    return { action: 'redirect', destination: '/login' }
  }
  if (snapshot.resolution === 'UNAVAILABLE') {
    return { action: 'redirect', destination: '/access/unavailable' }
  }
  if (snapshot.resolution === 'DENIED') {
    if (snapshot.onboardingState === 'PENDING_INVITATION') {
      return { action: 'redirect', destination: '/access/pending' }
    }
    if (snapshot.onboardingState === 'SETUP_REQUIRED') {
      return { action: 'redirect', destination: '/access/setup' }
    }
    if (snapshot.membershipState === 'MISSING') {
      return { action: 'redirect', destination: '/access/no-membership' }
    }
    if (snapshot.membershipState === 'INACTIVE') {
      return { action: 'redirect', destination: '/access/disabled' }
    }
    return { action: 'redirect', destination: '/access/unavailable' }
  }
  if (pathname === '/access/feature-not-enabled') {
    return { action: 'allow' }
  }
  if (!snapshot.medicationEmarEnabled && MEDICATION_EMAR_PATH.test(pathname)) {
    return { action: 'redirect', destination: '/access/feature-not-enabled' }
  }
  return resolveAuthenticatedRoute(
    pathname,
    rolesFromAccessSnapshot(snapshot),
    snapshot.capabilities,
  )
}

export function resolveAuthenticatedRoute(
  pathname: string,
  rawRoles: unknown,
  capabilities: readonly AccessCapability[] = [],
): RouteDecision {
  const context = getAccessContext(rawRoles, capabilities)
  if (context.workspace === 'none') {
    return { action: 'redirect', destination: '/access/unavailable' }
  }
  if (pathname === '/' || pathname === '/access' || ACCESS_STATE_PATH.test(pathname)) {
    return {
      action: 'redirect',
      destination: context.homePath as '/today' | '/family' | '/settings',
    }
  }
  if (context.homePath === '/settings') {
    return SETTINGS_PATH.test(pathname)
      ? { action: 'allow' }
      : { action: 'redirect', destination: '/settings' }
  }
  if (context.isExternal) {
    return FAMILY_PATH.test(pathname)
      ? { action: 'allow' }
      : { action: 'redirect', destination: '/family' }
  }
  if (FAMILY_PATH.test(pathname)) {
    return { action: 'redirect', destination: '/today' }
  }
  const hasFrontlineWorkspace = hasAccessCapability(
    context.capabilities,
    'FRONTLINE_ASSIGNED_VISITS_VIEW',
  )
  if (
    hasFrontlineWorkspace &&
    !hasAccessCapability(context.capabilities, 'TENANT_ADMIN')
  ) {
    const isAllowedFrontlinePath =
      pathname !== '/visits/new' &&
      pathname !== '/schedule/new' &&
      FRONTLINE_PATHS.some((pattern) => pattern.test(pathname))
    return isAllowedFrontlinePath
      ? { action: 'allow' }
      : { action: 'redirect', destination: '/today' }
  }
  const isAdminOnlyPath = ADMIN_ONLY_PATHS.some((pattern) => pattern.test(pathname))
  if (
    isAdminOnlyPath &&
    !hasAccessCapability(context.capabilities, 'TENANT_ADMIN')
  ) {
    return { action: 'redirect', destination: '/today' }
  }
  return { action: 'allow' }
}
