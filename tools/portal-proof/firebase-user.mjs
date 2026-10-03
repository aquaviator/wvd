// Shared shape validation for fresh Firebase account proofs. This does not
// confer portal access; callers retain their own scope and token checks.
export function validFirebaseEmail(email) {
  return typeof email==='string'&&email.length<=320&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&!/[\x00-\x1f\x7f]/.test(email);
}
export function verifiedFirebaseAccount(user,uid) {
  return user?.uid===uid&&!user.disabled&&user.emailVerified===true&&validFirebaseEmail(user.email)&&Array.isArray(user.providerData)&&user.providerData.some(item=>['google.com','password'].includes(item?.providerId));
}
