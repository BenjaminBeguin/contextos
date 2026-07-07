"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Tags <html> with the current route's grid intensity so the squared background
 * is a touch stronger on the dashboard and very discreet inside a project.
 */
export function GridScope() {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.dataset.grid = pathname === "/dashboard" ? "dashboard" : "app";
  }, [pathname]);
  return null;
}
