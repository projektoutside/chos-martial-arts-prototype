export const accountPasswordPolicyText = "Use at least 12 characters with uppercase, lowercase, a number, and a symbol.";

export function isStrongAccountPassword(password: string) {
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export function validateAccountPasswordChange(password: string, confirmation: string) {
  const cleanedPassword = password.trim();
  if (!cleanedPassword || !confirmation.trim()) return "Enter and confirm a new password.";
  if (cleanedPassword !== confirmation.trim()) return "Passwords must match.";
  if (!isStrongAccountPassword(cleanedPassword)) return accountPasswordPolicyText;
  return undefined;
}
