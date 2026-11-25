import type { Coupon } from "./types";

export function couponError(coupon: Coupon | undefined, now = new Date()) {
  if (!coupon || !coupon.active) return "No encontramos ese cupón.";
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now.getTime()) {
    return "Ese cupón ya venció.";
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return "Ese cupón ya se agotó.";
  }
  return null;
}

export function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}
