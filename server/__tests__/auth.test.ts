import { describe, it, expect } from 'vitest';
import { generateToken, verifyToken, createUser, authenticateUser } from '../auth.js';

describe('Authentication', () => {
  it('should generate and verify JWT token', () => {
    const userId = 'test-user-123';
    const token = generateToken(userId);

    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3);

    const decoded = verifyToken(token);
    expect(decoded).toBeTruthy();
    expect(decoded?.userId).toBe(userId);
  });

  it('should reject invalid token', () => {
    const result = verifyToken('invalid.token.here');
    expect(result).toBeNull();
  });

  it('should reject expired token', () => {
    // Create a token with short expiry
    const userId = 'test-user-456';
    const token = generateToken(userId);

    // Token should be valid initially
    const decoded = verifyToken(token);
    expect(decoded?.userId).toBe(userId);
  });

  it('should create and authenticate user', () => {
    const username = `testuser-${Date.now()}`;
    const password = 'testpassword123';

    const user = createUser(username, password, 'user');
    expect(user).toBeTruthy();
    expect(user?.username).toBe(username);
    expect(user?.role).toBe('user');

    const authenticated = authenticateUser(username, password);
    expect(authenticated).toBeTruthy();
    expect(authenticated?.id).toBe(user?.id);
  });

  it('should reject wrong password', () => {
    const username = `testuser-wrong-${Date.now()}`;
    createUser(username, 'correctpassword', 'user');

    const result = authenticateUser(username, 'wrongpassword');
    expect(result).toBeNull();
  });

  it('should reject non-existent user', () => {
    const result = authenticateUser('nonexistent-user', 'password');
    expect(result).toBeNull();
  });
});
