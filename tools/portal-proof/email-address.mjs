// Shared address shape check only. Verification, current account status and
// permission to receive a message remain separate caller responsibilities.
export function validEmailAddress(email) {
  return typeof email==='string'&&email.length<=320&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&!/[\x00-\x1f\x7f]/.test(email);
}
