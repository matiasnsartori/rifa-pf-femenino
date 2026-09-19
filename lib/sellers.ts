export interface SellerRow {
  id: string;
  displayName: string;
  isAdmin: boolean;
  hasSales: boolean;
}

export type Guard = { allowed: true } | { allowed: false; reason: string };

const ALLOWED: Guard = { allowed: true };

function isLastAdmin(target: SellerRow, all: SellerRow[]): boolean {
  if (!target.isAdmin) return false;
  return all.filter((row) => row.isAdmin && row.id !== target.id).length === 0;
}

export function canRemoveSeller(target: SellerRow, all: SellerRow[]): Guard {
  if (target.hasSales) {
    return {
      allowed: false,
      reason: "Tiene ventas cargadas. Borrarla dejaría esas ventas sin dueño.",
    };
  }
  if (isLastAdmin(target, all)) {
    return { allowed: false, reason: "Es la única admin. Nombrá otra antes de darla de baja." };
  }
  return ALLOWED;
}

export function canRevokeAdmin(target: SellerRow, all: SellerRow[]): Guard {
  if (isLastAdmin(target, all)) {
    return { allowed: false, reason: "Es la única admin. Nombrá otra antes de sacarle el rol." };
  }
  return ALLOWED;
}
