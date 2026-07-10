import { AuthoritativeAccessSnapshot, rolesFromAccessSnapshot } from './access-snapshot'
import { normalizeAppRoles } from './roles'

export type AppWorkspace = 'staff' | 'family' | 'none'
export type AppHomePath = '/today' | '/family' | '/access'

export interface AccessContext {
  roles: string[]
  surface: 'admin' | 'staff' | 'family' | 'none'
  isAdmin: boolean
  isStaff: boolean
  isClientSelf: boolean
  isExternal: boolean
  workspace: AppWorkspace
  homePath: AppHomePath
}

export type AccessDestination =
  | '/login'
  | '/today'
  | '/family'
  | '/access/no-membership'
  | '/access/disabled'
  | '/access/pending'
  | '/access/setup'
  | '/access/unavailable'

export type RouteDecision =
  | { action: 'allow' }
  | { action: 'redirect'; destination: AccessDestination }

const ADMIN_ONLY_PATHS = [
  /^\/admin(?:\/|$)/,
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
const FAMILY_PATH = /^\/family(?:\/|$)/
const ACCESS_STATE_PATH = /^\/access\/(?:no-membership|disabled|pending|setup|unavailable)$/

export function resolveProtectedRoute(
  pathname: string,
  authenticated: boolean,
  rawRoles: unknown,
): RouteDecision {
  if (!authenticated) return { action: 'redirect', destination: '/login' }
  return resolveAuthenticatedRoute(pathname, rawRoles)
}

export function getAccessContext(rawRoles: unknown): AccessContext {
  const roles = normalizeAppRoles(rawRoles)
  const isAdmin = roles.includes('admin')
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
    homePath: isStaff ? '/today' : isExternal ? '/family' : '/access',
  }
}

export function getAccessContextFromSnapshot(snapshot: AuthoritativeAccessSnapshot): AccessContext {
  return getAccessContext(rolesFromAccessSnapshot(snapshot))
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
  return resolveAuthenticatedRoute(pathname, rolesFromAccessSnapshot(snapshot))
}

export function resolveAuthenticatedRoute(pathname: string, rawRoles: unknown): RouteDecision {
  const context = getAccessContext(rawRoles)
  if (context.workspace === 'none') {
    return { action: 'redirect', destination: '/access/unavailable' }
  }
  if (pathname === '/' || pathname === '/access' || ACCESS_STATE_PATH.test(pathname)) {
    return { action: 'redirect', destination: context.homePath as '/today' | '/family' }
  }
  if (context.isExternal) {
    return FAMILY_PATH.test(pathname)
      ? { action: 'allow' }
      : { action: 'redirect', destination: '/family' }
  }
  if (FAMILY_PATH.test(pathname)) {
    return { action: 'redirect', destination: '/today' }
  }
  const isAdminOnlyPath = ADMIN_ONLY_PATHS.some((pattern) => pattern.test(pathname))
  if (isAdminOnlyPath && !context.isAdmin) {
    return { action: 'redirect', destination: '/today' }
  }
  return { action: 'allow' }
}
