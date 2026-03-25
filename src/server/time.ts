export function toMilliseconds(seconds: number): number {
  return seconds * 1000;
}

export function toSeconds(milliseconds: number): number {
  return milliseconds / 1000;
}

export function createExpiresAt(secondsFromNow: number): Date {
  const expirationMs = Date.now() + toMilliseconds(secondsFromNow);
  return new Date(Math.floor(expirationMs / toMilliseconds(1)) * toMilliseconds(1));
}
