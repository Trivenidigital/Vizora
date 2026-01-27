/**
 * Generates a random 6-character alphanumeric pairing code
 */
export function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing characters
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Validates pairing code format (6 alphanumeric characters)
 */
export function isValidPairingCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}
