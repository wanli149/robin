/**
 * Response Signer Utilities Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { signResponse, verifyResponseSignature } from './response_signer';

const TEST_SECRET = 'test-secret-key';

describe('signResponse', () => {
  it('should generate a signature for data', async () => {
    const data = { message: 'hello' };
    const timestamp = Math.floor(Date.now() / 1000);
    
    const signature = await signResponse(data, TEST_SECRET, timestamp);
    
    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');
    expect(signature.length).toBeGreaterThan(0);
  });

  it('should generate same signature for same data and timestamp', async () => {
    const data = { message: 'hello' };
    const timestamp = 1704067200; // Fixed timestamp
    
    const sig1 = await signResponse(data, TEST_SECRET, timestamp);
    const sig2 = await signResponse(data, TEST_SECRET, timestamp);
    
    expect(sig1).toBe(sig2);
  });

  it('should generate different signatures for different data', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    
    const sig1 = await signResponse({ a: 1 }, TEST_SECRET, timestamp);
    const sig2 = await signResponse({ a: 2 }, TEST_SECRET, timestamp);
    
    expect(sig1).not.toBe(sig2);
  });

  it('should generate different signatures for different timestamps', async () => {
    const data = { message: 'hello' };
    
    const sig1 = await signResponse(data, TEST_SECRET, 1000);
    const sig2 = await signResponse(data, TEST_SECRET, 2000);
    
    expect(sig1).not.toBe(sig2);
  });

  it('should generate different signatures for different secrets', async () => {
    const data = { message: 'hello' };
    const timestamp = Math.floor(Date.now() / 1000);
    
    const sig1 = await signResponse(data, 'secret1', timestamp);
    const sig2 = await signResponse(data, 'secret2', timestamp);
    
    expect(sig1).not.toBe(sig2);
  });
});

describe('verifyResponseSignature', () => {
  it('should verify a valid signature', async () => {
    const data = { message: 'hello' };
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signResponse(data, TEST_SECRET, timestamp);
    
    const isValid = await verifyResponseSignature(data, timestamp, signature, TEST_SECRET);
    
    expect(isValid).toBe(true);
  });

  it('should reject invalid signature', async () => {
    const data = { message: 'hello' };
    const timestamp = Math.floor(Date.now() / 1000);
    
    const isValid = await verifyResponseSignature(data, timestamp, 'invalid-signature', TEST_SECRET);
    
    expect(isValid).toBe(false);
  });

  it('should reject tampered data', async () => {
    const originalData = { message: 'hello' };
    const tamperedData = { message: 'hacked' };
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signResponse(originalData, TEST_SECRET, timestamp);
    
    const isValid = await verifyResponseSignature(tamperedData, timestamp, signature, TEST_SECRET);
    
    expect(isValid).toBe(false);
  });

  it('should reject expired timestamp', async () => {
    const data = { message: 'hello' };
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago
    const signature = await signResponse(data, TEST_SECRET, oldTimestamp);
    
    // Default maxAge is 300 seconds
    const isValid = await verifyResponseSignature(data, oldTimestamp, signature, TEST_SECRET);
    
    expect(isValid).toBe(false);
  });

  it('should accept timestamp within maxAge', async () => {
    const data = { message: 'hello' };
    const recentTimestamp = Math.floor(Date.now() / 1000) - 100; // 100 seconds ago
    const signature = await signResponse(data, TEST_SECRET, recentTimestamp);
    
    const isValid = await verifyResponseSignature(data, recentTimestamp, signature, TEST_SECRET);
    
    expect(isValid).toBe(true);
  });

  it('should respect custom maxAge', async () => {
    const data = { message: 'hello' };
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400;
    const signature = await signResponse(data, TEST_SECRET, oldTimestamp);
    
    // With custom maxAge of 500 seconds, should be valid
    const isValid = await verifyResponseSignature(data, oldTimestamp, signature, TEST_SECRET, 500);
    
    expect(isValid).toBe(true);
  });
});
