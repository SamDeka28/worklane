/** Tax is edited as a percentage but stored in basis points (1% = 100 bps). */
export function percentFieldToBps(formData: FormData, percentName: string, bpsName: string) {
  const raw = String(formData.get(percentName) ?? "").trim();
  formData.delete(percentName);
  if (!raw) return;
  const percent = Number(raw);
  if (!Number.isFinite(percent)) return;
  formData.set(bpsName, String(Math.round(percent * 100)));
}
