export interface NavItem {
  href: string;
  label: string;
  icon: "overview" | "reports" | "clients" | "alerts" | "pipeline" | "settings";
  /** Count shown beside the label, e.g. reports waiting for review. */
  badgeKey?: "review" | "alerts";
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/reports", label: "Reports", icon: "reports", badgeKey: "review" },
  { href: "/clients", label: "Clients", icon: "clients" },
  { href: "/alerts", label: "Alerts", icon: "alerts", badgeKey: "alerts" },
  { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
  { href: "/settings", label: "Branding", icon: "settings" },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
