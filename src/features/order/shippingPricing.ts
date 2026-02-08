/**
 * Distance-based shipping cost (IDR). Ready for future pricing; for now all bands are Rp0.
 * Format: { maxDistanceKm, costIdr } - cost applies when distance <= maxDistanceKm.
 */
export const SHIPPING_BANDS: Array<{ maxDistanceKm: number; costIdr: number }> = [
  { maxDistanceKm: 5, costIdr: 0 },
  { maxDistanceKm: 10, costIdr: 0 },
  { maxDistanceKm: 15, costIdr: 0 },
  { maxDistanceKm: 20, costIdr: 0 },
  { maxDistanceKm: 9999, costIdr: 0 }, // beyond 20km, Rp0 for now
];

export function getShippingCostForDistanceKm(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return 0;
  for (const band of SHIPPING_BANDS) {
    if (distanceKm <= band.maxDistanceKm) return band.costIdr;
  }
  const last = SHIPPING_BANDS[SHIPPING_BANDS.length - 1];
  return last ? last.costIdr : 0;
}
