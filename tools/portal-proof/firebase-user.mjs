// Shared shape validation for fresh Firebase account proofs. This does not
// confer portal access; callers retain their own scope and token checks.
import {validEmailAddress as validFirebaseEmail} from './email-address.mjs';
export {validFirebaseEmail};
export function verifiedFirebaseAccount(user,uid) {
  return user?.uid===uid&&!user.disabled&&user.emailVerified===true&&validFirebaseEmail(user.email)&&Array.isArray(user.providerData)&&user.providerData.some(item=>['google.com','password'].includes(item?.providerId));
}
