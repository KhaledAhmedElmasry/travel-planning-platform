// Requirement: FLT-17.

export function calculateDurationMinutes(
  departureUtc: Date,
  arrivalUtc: Date,
): number {
  return Math.round((arrivalUtc.getTime() - departureUtc.getTime()) / 60_000);
}
