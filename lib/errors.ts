export type SaleErrorKind = "number-taken" | "not-allowed" | "invalid" | "unknown";

export interface SaleError {
  kind: SaleErrorKind;
  message: string;
}

export interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
}

const UNIQUE_VIOLATION = "23505";
const INSUFFICIENT_PRIVILEGE = "42501";
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";

export function toSaleError(
  error: PostgrestLikeError | null,
  saleNumber: number,
): SaleError | null {
  if (!error) return null;

  switch (error.code) {
    case UNIQUE_VIOLATION:
      return {
        kind: "number-taken",
        message: `El ${saleNumber} ya está vendido. Actualizá la grilla y elegí otro.`,
      };
    case INSUFFICIENT_PRIVILEGE:
      return {
        kind: "not-allowed",
        message: "No tenés permiso para hacer esto.",
      };
    case CHECK_VIOLATION:
    case FOREIGN_KEY_VIOLATION:
      return {
        kind: "invalid",
        message: "Los datos cargados no son válidos. Revisá el número y el nombre.",
      };
    default:
      return {
        kind: "unknown",
        message: "No se pudo guardar. Probá de nuevo en un momento.",
      };
  }
}
