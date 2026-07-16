export const accountPasswordPolicyText = "Use at least 12 characters with uppercase, lowercase, a number, and a symbol.";

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {};
}

export function requiresPasswordChange(metadata: unknown) {
  return metadataRecord(metadata).requires_password_change === true;
}

export function activationRequiredAppMetadata(metadata?: unknown) {
  return { ...metadataRecord(metadata), requires_password_change: true };
}

export function activatedAppMetadata(metadata?: unknown) {
  return { ...metadataRecord(metadata), requires_password_change: false };
}

export function isStrongActivationPassword(password: string) {
  return password.length >= 12
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

export function validateActivationPassword(newPassword: string, temporaryPassword: string) {
  const cleanedPassword = newPassword.trim();
  if (!isStrongActivationPassword(cleanedPassword)) return accountPasswordPolicyText;
  if (cleanedPassword === temporaryPassword.trim()) {
    return "Choose a new password that is different from your temporary password.";
  }
  return undefined;
}
