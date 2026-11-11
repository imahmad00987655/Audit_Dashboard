"use client";

import { useCallback, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { COMPONENT_DOMAIN } from "@/lib/data-access";

export function usePermission() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const isAdmin = user?.role === "admin";
  const dataAccess = user?.dataAccess;
  const unrestricted = isAdmin || Boolean(dataAccess?.unrestricted);
  const domains = dataAccess?.domains ?? [];
  const organizations = dataAccess?.organizations ?? [];

  const hasDomain = useCallback(
    (domain: string | null | undefined) => {
      if (domain == null) return true;
      if (unrestricted) return true;
      return domains.includes(domain);
    },
    [unrestricted, domains]
  );

  const can = useCallback(
    (key: string) => {
      if (isAdmin) return true;
      if (!permissions.includes(key)) return false;
      return hasDomain(COMPONENT_DOMAIN[key]);
    },
    [isAdmin, permissions, hasDomain]
  );

  const canAny = useCallback(
    (keys: string[]) => {
      if (isAdmin) return true;
      return keys.some((k) => can(k));
    },
    [isAdmin, can]
  );

  const canAll = useCallback(
    (keys: string[]) => {
      if (isAdmin) return true;
      return keys.every((k) => can(k));
    },
    [isAdmin, can]
  );

  return useMemo(
    () => ({
      can,
      canAny,
      canAll,
      permissions,
      isAdmin,
      dataAccess,
      organizations,
      domains,
      unrestricted,
      hasDomain,
    }),
    [can, canAny, canAll, permissions, isAdmin, dataAccess, organizations, domains, unrestricted, hasDomain]
  );
}
