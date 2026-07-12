import { hasAccessCapability, type AccessCapability } from "../../lib/auth/capabilities";

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
    exact: true,
  },
  { id: "my-shift", href: "/shift", label: "My shift" },
  { id: "profile-help", href: "/settings", label: "Profile/help" },
];

const managementNavigation: readonly HeaderNavigationItem[] = [
  { id: "settings", href: "/settings", label: "Settings" },
];

const familyNavigation: readonly HeaderNavigationItem[] = [
  { id: "home", href: "/family", label: "Home", exact: true },
  {
    id: "updates",
    href: "/family#care-rooms",
    label: "Updates",
    aliases: ["/family/care-rooms"],
  },
  { id: "latest-update", href: "/family#updates", label: "Latest update" },
  {
    id: "concerns-help",
    href: "/family#concerns-help",
    label: "Concerns/help",
  },
];

export function getHeaderNavigation(
  surface: HeaderSurface,
  pathname: string,
  capabilities: readonly AccessCapability[] = [],
): readonly HeaderNavigationItem[] {
  if (surface === "admin") return adminNavigation;
  if (surface === "management") return managementNavigation;
  if (surface === "family") return familyNavigation;
  if (surface === "staff") {
    const currentVisit =
      /^\/(?:visits|schedule)\/[^/]+$/.test(pathname) &&
      !pathname.endsWith("/new")
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
    ].filter((item) => {
      if (item.id === "my-shift") {
        return hasAccessCapability(capabilities, "FRONTLINE_SHIFT_VIEW");
      }
      if (["today", "my-visits", "current-visit"].includes(item.id)) {
        return hasAccessCapability(
          capabilities,
          "FRONTLINE_ASSIGNED_VISITS_VIEW",
        );
      }
      return hasAccessCapability(capabilities, "PROFILE_HELP_VIEW");
    });
  }
  return [];
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
