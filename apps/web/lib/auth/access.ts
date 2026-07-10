import { normalizeAppRoles } from './roles'

export type AppWorkspace = 'staff' | 'family'

export interface AccessContext {
  roles: string[]
  isAdmin: boolean
  isStaff: boolean
  isClientSelf: boolean
  isExternal: boolean
  workspace: AppWorkspace
  homePath: '/today' | '/family'
}

export type RouteDecision =
  | { action: 'allow' }
  | { action: 'redirect'; destination: '/login' | '/today' | '/family' }

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

export function resolveProtectedRoute(
  pathname: string,
  authenticated: boolean,
  rawRoles: unknown,
): RouteDecision {
  if (!authenticated) {
    return { action: 'redirect', destination: '/login' }
  }

  return resolveAuthenticatedRoute(pathname, rawRoles)
}

export function getAccessContext(rawRoles: unknown): AccessContext {
  const roles = normalizeAppRoles(rawRoles)
  const isAdmin = roles.includes('admin')
  const isStaff = isAdmin || roles.includes('carer')
  const isClientSelf = roles.includes('client')
  const isExternal = !isStaff
  const workspace: AppWorkspace = isExternal ? 'family' : 'staff'

  return {
    roles,
    isAdmin,
    isStaff,
    isClientSelf,
    isExternal,
    workspace,
    homePath: isExternal ? '/family' : '/today',
  }
}

export function resolveAuthenticatedRoute(
  pathname: string,
  rawRoles: unknown,
): RouteDecision {
  const context = getAccessContext(rawRoles)

  if (pathname === '/') {
    return { action: 'redirect', destination: context.homePath }
  }

  if (context.isExternal) {
    if (FAMILY_PATH.test(pathname)) {
      return { action: 'allow' }
    }

    return { action: 'redirect', destination: '/family' }
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
