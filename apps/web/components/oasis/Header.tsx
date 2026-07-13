"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { signOut as nextAuthSignOut, useSession } from "next-auth/react";
import { cn } from "../../lib/utils";
import { resolveAuthMode } from "../../lib/auth/mode";
import { useClientAccess } from "../providers/ClientAccessProvider";
import {
  createHeaderViewer,
  getHeaderAccessLabel,
  type HeaderViewer,
} from "./headerIdentity";
import {
  getHeaderHomePath,
  getHeaderNavigation,
  isHeaderNavigationItemActive,
} from "./headerNavigation";

export interface HeaderProps {
  className?: string;
}

interface HeaderContentProps {
  className?: string;
  pathname: string;
  viewer: HeaderViewer;
  onSignOut: () => Promise<void>;
}

function getBrowserAuthMode() {
  return resolveAuthMode({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER:
      process.env.NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER,
    NEXT_PUBLIC_LOCAL_AUTH_ENABLED: process.env.NEXT_PUBLIC_LOCAL_AUTH_ENABLED,
  } as NodeJS.ProcessEnv);
}

export function Header(props: HeaderProps) {
  return getBrowserAuthMode() === "clerk" ? (
    <ClerkHeader {...props} />
  ) : (
    <NextAuthHeader {...props} />
  );
}

function ClerkHeader({ className }: HeaderProps) {
  const pathname = usePathname();
  const { isLoaded } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const access = useClientAccess();
  const viewer = createHeaderViewer({
    pathname,
    status: isLoaded ? access.status : "loading",
    roles: access.roles,
    capabilities: access.capabilities,
    userName: user?.fullName,
    userEmail: user?.primaryEmailAddress?.emailAddress,
  });

  return (
    <HeaderContent
      className={className}
      pathname={pathname}
      viewer={viewer}
      onSignOut={() => signOut({ redirectUrl: "/login" })}
    />
  );
}

function NextAuthHeader({ className }: HeaderProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const access = useClientAccess();
  const viewer = createHeaderViewer({
    pathname,
    status: status === "loading" ? "loading" : access.status,
    roles: access.roles,
    capabilities: access.capabilities,
    userName: session?.user?.name,
    userEmail: session?.user?.email,
  });

  async function handleSignOut() {
    try {
      await nextAuthSignOut({ redirect: false });
    } finally {
      window.location.assign("/api/auth/cognito-logout");
    }
  }

  return (
    <HeaderContent
      className={className}
      pathname={pathname}
      viewer={viewer}
      onSignOut={handleSignOut}
    />
  );
}

function HeaderContent({
  className,
  pathname,
  viewer,
  onSignOut,
}: HeaderContentProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const navigationTriggerRef = useRef<HTMLButtonElement>(null);
  const { accessContext, userName, userEmail, userInitial } = viewer;
  const userRole = getHeaderAccessLabel(viewer);
  const managementRole = viewer.roles.find((role) =>
    ["manager", "care_manager", "office"].includes(role),
  );
  const navigationSurface =
    accessContext.surface === "staff" && accessContext.homePath === "/settings"
      ? "management"
      : accessContext.surface;
  const homePath = getHeaderHomePath(
    navigationSurface,
    accessContext.homePath,
  );
  const navItems = getHeaderNavigation(
    navigationSurface,
    pathname,
    accessContext.capabilities,
  );

  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) return;

    const addedId = !main.id;
    const addedTabIndex = !main.hasAttribute("tabindex");
    if (addedId) main.id = "main-content";
    if (addedTabIndex) main.tabIndex = -1;

    return () => {
      if (addedId && main.id === "main-content") main.removeAttribute("id");
      if (addedTabIndex && main.tabIndex === -1) main.removeAttribute("tabindex");
    };
  }, [pathname]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (profileOpen) {
          setProfileOpen(false);
          accountTriggerRef.current?.focus();
        } else if (mobileMenuOpen) {
          setMobileMenuOpen(false);
          navigationTriggerRef.current?.focus();
        }
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen, profileOpen]);

  const workspaceLabel =
    managementRole === "care_manager"
      ? "Care manager workspace"
      : managementRole === "manager"
        ? "Manager workspace"
        : managementRole === "office"
          ? "Office workspace"
          : accessContext.surface === "admin"
            ? "Admin workspace"
            : accessContext.surface === "staff"
              ? "Carer workspace"
              : accessContext.surface === "family"
                ? "Family workspace"
                : "Secure access";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-oasis-border bg-white",
        className,
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-oasis-teal-dark focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-oasis-teal focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-3">
          <Link
            href={homePath}
            className="flex min-h-11 min-w-11 shrink-0 items-center gap-3 rounded-md text-oasis-ink hover:no-underline"
            aria-label={`Oasis Care, ${workspaceLabel}`}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-md bg-oasis-teal text-base font-bold text-white"
              aria-hidden="true"
            >
              O
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block text-sm font-bold tracking-tight">
                Oasis Care
              </span>
              <span className="block text-xs text-oasis-muted">
                {workspaceLabel}
              </span>
            </span>
          </Link>

          <nav
            className="hidden min-w-0 items-center gap-0.5 xl:flex"
            aria-label="Primary navigation"
          >
            {navItems.map((item) => {
              const active = isHeaderNavigationItemActive(pathname, item);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-oasis-muted hover:bg-base-gray-50 hover:text-oasis-ink hover:no-underline",
                    active && "bg-oasis-teal-soft text-oasis-teal-dark",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <div className="relative">
              <button
                ref={accountTriggerRef}
                type="button"
                className="flex min-h-11 items-center gap-2 rounded-md px-2 text-left hover:bg-base-gray-50"
                onClick={() => {
                  setProfileOpen((open) => !open);
                  setMobileMenuOpen(false);
                }}
                aria-expanded={profileOpen}
                aria-controls="oasis-account-menu"
                aria-label={
                  profileOpen ? "Close account menu" : "Open account menu"
                }
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-oasis-teal-soft text-sm font-bold text-oasis-teal-dark"
                  aria-hidden="true"
                >
                  {userInitial}
                </span>
                <span className="hidden max-w-36 sm:block">
                  <span className="block truncate text-sm font-semibold text-oasis-ink">
                    {userName || "Account"}
                  </span>
                  <span className="block truncate text-xs text-oasis-muted">
                    {userRole || workspaceLabel}
                  </span>
                </span>
                <svg
                  className="h-4 w-4 text-oasis-muted"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="m6 8 4 4 4-4"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {profileOpen && (
                <div
                  id="oasis-account-menu"
                  className="absolute right-0 mt-2 w-64 rounded-lg border border-oasis-border bg-white p-2 shadow-md"
                >
                  <div className="border-b border-oasis-border px-3 py-2">
                    <p className="truncate text-sm font-semibold text-oasis-ink">
                      {userName || "Account"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-oasis-muted">
                      {userEmail || userRole || "Authenticated user"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onSignOut()}
                    className="mt-2 flex min-h-11 w-full items-center rounded-md px-3 text-sm font-semibold text-oasis-danger hover:bg-oasis-danger-soft"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>

            <button
              ref={navigationTriggerRef}
              type="button"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-oasis-ink hover:bg-base-gray-50 xl:hidden"
              onClick={() => {
                setMobileMenuOpen((open) => !open);
                setProfileOpen(false);
              }}
              aria-expanded={mobileMenuOpen}
              aria-controls="oasis-mobile-navigation"
              aria-label={
                mobileMenuOpen ? "Close navigation" : "Open navigation"
              }
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  d={
                    mobileMenuOpen
                      ? "M6 6l12 12M18 6 6 18"
                      : "M4 7h16M4 12h16M4 17h16"
                  }
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            id="oasis-mobile-navigation"
            className="border-t border-oasis-border py-3 xl:hidden"
            aria-label="Primary navigation"
          >
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {navItems.map((item) => {
                const active = isHeaderNavigationItemActive(pathname, item);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-oasis-muted hover:bg-base-gray-50 hover:text-oasis-ink hover:no-underline",
                      active && "bg-oasis-teal-soft text-oasis-teal-dark",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
