export function isWebAuthnSupported() {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window;
}
