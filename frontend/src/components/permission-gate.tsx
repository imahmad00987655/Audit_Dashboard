"use client";

import type { ReactNode } from "react";
import { usePermission } from "@/hooks/use-permission";

type Props = {
  permission?: string;
  anyOf?: string[];
  children: ReactNode;
};

export function PermissionGate({ permission, anyOf, children }: Props) {
  const { can, canAny } = usePermission();

  if (permission && !can(permission)) return null;
  if (anyOf?.length && !canAny(anyOf)) return null;
  if (!permission && !anyOf?.length) return <>{children}</>;

  return <>{children}</>;
}
