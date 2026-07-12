export type HeaderSurface =
  | "admin"
  | "management"
  | "staff"
  | "family"
  | "none";

export type HeaderNavigationItem = {
  id: string;
  href: string;
  label: string;
  aliases?: readonly string[];
  exact?: boolean;
};

const adminNavigation: readonly HeaderNavigationItem[] = [
  { id: "today", href: "/today", label: "Today", aliases: ["/dashboard"] },
  { id: "people", href: "/people", label: "People", aliases: ["/clients"] },
  {
    id: "schedule",
    href: "/schedule",
    label: "Schedule",
    aliases: ["/visits"],
  },
  {
    id: "workforce",
    href: "/admin/carers",
    label: "Workforce",
    aliases: ["/staff", "/admin/analytics"],
  },
  {
    id: "family-updates",
    href: "/family-updates",
    label: "Family updates",
    aliases: ["/carebridge"],
  },
  {
    id: "reports",
    href: "/evidence",
    label: "Reports",
    aliases: ["/reports", "/admin/metrics"],
  },
  { id: "settings", href: "/settings", label: "Settings" },
];

const carerNavigation: readonly HeaderNavigationItem[] = [
  { id: "today", href: "/today", label: "Today", aliases: ["/dashboard"] },
  {
    id: "my-visits",
    href: "/visits",
    label: "My visits",
    aliases: ["/schedule"],
  },
  { id: "my-shift", href: "/shift", label: "My shift" },
  { id: "profile-help", href: "/settings", label: "Profile/help" },
];

const managementNavigation: readonly HeaderNavigationItem[] = [
  { id: "settings", href: "/settings", label: "Settings" },
];

const restrictedManagementRoles = new Set([
  "manager",
  "care_manager",
  "office",
]);

const familyNavigation: readonly HeaderNavigationItem[] = [
  { id: "home", href: "/family", label: "Home", exact: true },
  {
    id: "care-rooms",
    href: "/family#care-rooms",
    label: "Care rooms",
    aliases: ["/family/care-rooms"],
  },
  { id: "updates", href: "/family#updates", label: "Updates" },
  {
    id: "concerns-help",
    href: "/family#concerns-help",
    label: "Concerns/help",
  },
];

export function getHeaderNavigation(
  surface: HeaderSurface,
  pathname: string,
): readonly HeaderNavigationItem[] {
  if (surface === "admin") return adminNavigation;
  if (surface === "management") return managementNavigation;
  if (surface === "family") return familyNavigation;
  if (surface === "staff") {
    const currentVisit = /^\/visits\/[^/]+$/.test(pathname)
      ? [
          {
            id: "current-visit",
            href: pathname,
            label: "Current visit",
            exact: true,
          },
        ]
      : [];
    return [
      carerNavigation[0],
      carerNavigation[1],
      ...currentVisit,
      ...carerNavigation.slice(2),
    ];
  }
  return [];
}

export function getHeaderSurfaceForViewer(
  surface: Exclude<HeaderSurface, "management">,
  roles: readonly string[],
): HeaderSurface {
  if (surface === "staff" && hasRestrictedManagementRole(roles)) {
    return "management";
  }
  return surface;
}

export function hasRestrictedManagementRole(roles: readonly string[]): boolean {
  return roles.some((role) => restrictedManagementRoles.has(role));
}

export function getHeaderHomePath(
  surface: HeaderSurface,
  defaultHomePath: string,
): string {
  return surface === "management" ? "/settings" : defaultHomePath;
}

export function isHeaderNavigationItemActive(
  pathname: string,
  item: HeaderNavigationItem,
): boolean {
  const paths = [
    ...(item.href.includes("#") ? [] : [item.href]),
    ...(item.aliases ?? []),
  ];
  return paths.some((path) => {
    if (item.exact) return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}
