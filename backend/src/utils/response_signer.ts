/**
 * Response Signing Utility
 * Signs sensitive API responses to prevent man-in-the-middle tampering
 */

import { getCurrentTimestamp } from './time';

/**
 * Generate response signature
 * @param data Response data
 * @param secretKey Signing key
 * @param timestamp Timestamp
 */
export async function signResponse(
  data: unknown,
  secretKey: string,
  timestamp: number
): Promise<string> {
  const dataStr = JSON.stringify(data);
  const signData = `${dataStr}|${timestamp}|${secretKey}`;
  
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(signData);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padLeft(2, '0')).join('');
  
  return hashHex;
}

/**
 * Create signed response
 */
export async function createSignedResponse(
  data: unknown,
  secretKey: string
): Promise<{
  data: unknown;
  timestamp: number;
  signature: string;
}> {
  const timestamp = getCurrentTimestamp();
  const signature = await signResponse(data, secretKey, timestamp);
  
  return {
    data,
    timestamp,
    signature,
  };
}

/**
 * Verify response signature
 */
export async function verifyResponseSignature(
  data: unknown,
  timestamp: number,
  signature: string,
  secretKey: string,
  maxAge: number = 300 // Default 5 minutes validity
): Promise<boolean> {
  // Check if timestamp is expired
  const now = getCurrentTimestamp();
  if (Math.abs(now - timestamp) > maxAge) {
    return false;
  }
  
  // Verify signature
  const expectedSignature = await signResponse(data, secretKey, timestamp);
  return signature === expectedSignature;
}

// Polyfill for padLeft
declare global {
  interface String {
    padLeft(length: number, char: string): string;
  }
}

String.prototype.padLeft = function(length: number, char: string): string {
  return char.repeat(Math.max(0, length - this.length)) + this;
};
