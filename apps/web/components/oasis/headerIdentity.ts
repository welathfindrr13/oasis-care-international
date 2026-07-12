import { getAccessContext, type AccessContext } from "../../lib/auth/access";
import { normalizeAppRoles } from "../../lib/auth/roles";

type HeaderAuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface HeaderViewer {
  accessContext: AccessContext;
  roles: string[];
  userRole: string;
  userName: string;
  userEmail: string;
  userInitial: string;
  isAdmin: boolean;
  status: HeaderAuthStatus;
}

interface HeaderViewerInput {
  pathname: string;
  status: HeaderAuthStatus;
  roles: unknown;
  userName?: string | null;
  userEmail?: string | null;
}

export function formatHeaderRoleLabel(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (!normalized) return "";

  switch (normalized) {
    case "admin":
      return "ADMIN";
    case "carer":
      return "CARER";
    case "care_manager":
      return "CARE MANAGER";
    case "manager":
      return "MANAGER";
    case "office":
      return "OFFICE";
    case "client":
      return "CLIENT";
    default:
      return normalized.replace(/_/g, " ").toUpperCase();
  }
}

function hasRawRoles(roles: unknown): boolean {
  if (Array.isArray(roles)) return roles.length > 0;
  return typeof roles === "string" && roles.trim().length > 0;
}

function firstSuppliedRole(roles: unknown): string {
  const value = Array.isArray(roles) ? roles[0] : roles;
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/\s+/g, "_")
    : "";
}

export function createHeaderViewer({
  pathname,
  status,
  roles,
  userName,
  userEmail,
}: HeaderViewerInput): HeaderViewer {
  const normalizedRoles = hasRawRoles(roles) ? normalizeAppRoles(roles) : [];
  const effectiveRoles = status === "authenticated" ? normalizedRoles : [];
  const accessContext = getAccessContext(effectiveRoles);
  const suppliedRole = firstSuppliedRole(roles);
  const primaryRole = effectiveRoles.includes(suppliedRole)
    ? suppliedRole
    : effectiveRoles[0];
  const email = userEmail || "";
  const name =
    userName || email.split("@")[0] || (status === "loading" ? "" : "User");
  const initialSource = userName || email || "U";

  return {
    accessContext,
    roles: effectiveRoles,
    userRole: primaryRole ? formatHeaderRoleLabel(primaryRole) : "",
    userName: name,
    userEmail: email,
    userInitial: initialSource.charAt(0).toUpperCase(),
    isAdmin: effectiveRoles.includes("admin"),
    status,
  };
}

export function getHeaderAccessLabel(viewer: HeaderViewer): string {
  if (viewer.accessContext.isExternal) {
    return "FAMILY ACCESS";
  }

  return viewer.userRole || (viewer.status === "loading" ? "" : "MEMBER");
}
