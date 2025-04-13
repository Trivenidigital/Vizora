/**
 * Auth Controller Tests
 * Tests for authentication and user management functionality
 */

const request = require('supertest');
const { app } = require('../src/server');
const User = require('../src/models/User');
const mongoose = require('mongoose');

describe('Auth Controller', () => {
  beforeEach(async () => {
    // Clear users collection before each test
    await User.deleteMany({});
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.username).toBe(userData.username);
      expect(res.body.email).toBe(userData.email);
      expect(res.body.token).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.password).toBeUndefined();
    });

    it('should not register a user with an existing email', async () => {
      // Create a user first
      await User.create({
        username: 'existing',
        email: 'existing@example.com',
        password: 'Password123!',
        firstName: 'Existing',
        lastName: 'User'
      });

      // Try to register with the same email
      const userData = {
        username: 'newuser',
        email: 'existing@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User'
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Email already in use');
    });

    it('should not register a user with an existing username', async () => {
      // Create a user first
      await User.create({
        username: 'existinguser',
        email: 'user1@example.com',
        password: 'Password123!',
        firstName: 'Existing',
        lastName: 'User'
      });

      // Try to register with the same username
      const userData = {
        username: 'existinguser',
        email: 'user2@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User'
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Username already in use');
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      // Create a test user before each login test
      await User.create({
        username: 'logintest',
        email: 'login@example.com',
        password: 'Password123!',
        firstName: 'Login',
        lastName: 'Test'
      });
    });

    it('should login a user with valid credentials', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'Password123!'
      };

      const res = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.email).toBe(loginData.email);
      expect(res.body.token).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('should not login with incorrect password', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'WrongPassword123!'
      };

      const res = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid credentials');
    });

    it('should not login with non-existent email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'Password123!'
      };

      const res = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid credentials');
    });
  });

  describe('User Logout', () => {
    let token;
    let refreshToken;
    let userId;

    beforeEach(async () => {
      // Create a test user and get tokens
      const { user, tokens } = await createUserWithTokens();
      token = tokens.token;
      refreshToken = tokens.refreshToken;
      userId = user._id;
    });

    it('should logout a user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Logged out successfully');

      // Check that the refresh token was removed
      const user = await User.findById(userId);
      const tokenExists = user.refreshTokens.some(t => t.token === refreshToken);
      expect(tokenExists).toBe(false);
    });

    it('should return error if no refresh token provided', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Refresh token is required');
    });

    it('should require authentication to logout', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Refresh Token', () => {
    let refreshToken;

    beforeEach(async () => {
      // Create a test user and get refresh token
      const { tokens } = await createUserWithTokens();
      refreshToken = tokens.refreshToken;
    });

    it('should issue a new access token with valid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
    });

    it('should reject invalid refresh tokens', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid refresh token');
    });

    it('should require a refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Refresh token is required');
    });
  });

  describe('Get Current User', () => {
    let token;
    let user;

    beforeEach(async () => {
      // Create a test user and get token
      const result = await createUserWithTokens();
      token = result.tokens.token;
      user = result.user;
    });

    it('should return the current user profile', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id.toString()).toBe(user._id.toString());
      expect(res.body.user.email).toBe(user.email);
      expect(res.body.user.username).toBe(user.username);
    });

    it('should not allow access without authentication', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Update User Profile', () => {
    let token;
    let user;

    beforeEach(async () => {
      // Create a test user and get token
      const result = await createUserWithTokens();
      token = result.tokens.token;
      user = result.user;
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        preferences: {
          theme: 'dark',
          notifications: true
        }
      };

      const res = await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.firstName).toBe(updateData.firstName);
      expect(res.body.user.lastName).toBe(updateData.lastName);
      expect(res.body.user.preferences.theme).toBe(updateData.preferences.theme);
      expect(res.body.user.preferences.notifications).toBe(updateData.preferences.notifications);
    });

    it('should not allow update without authentication', async () => {
      const res = await request(app)
        .put('/api/auth/me')
        .send({ firstName: 'Updated' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Change Password', () => {
    let token;
    let user;

    beforeEach(async () => {
      // Create a test user and get token
      const result = await createUserWithTokens();
      token = result.tokens.token;
      user = result.user;
    });

    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'Password123!',
        newPassword: 'NewPassword456!'
      };

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Password updated successfully');

      // Verify the new password works for login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: passwordData.newPassword
        });

      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });

    it('should reject if current password is incorrect', async () => {
      const passwordData = {
        currentPassword: 'WrongPassword!',
        newPassword: 'NewPassword456!'
      };

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Current password is incorrect');
    });

    it('should require authentication to change password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewPassword456!'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Forgot Password', () => {
    beforeEach(async () => {
      // Create a test user
      await User.create({
        username: 'forgotpass',
        email: 'forgot@example.com',
        password: 'Password123!',
        firstName: 'Forgot',
        lastName: 'Password'
      });
    });

    it('should generate a reset token for existing email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'forgot@example.com' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Password reset link has been sent');
      expect(res.body.resetToken).toBeDefined(); // Note: In production, this would not be returned

      // Verify token was saved to user
      const user = await User.findOne({ email: 'forgot@example.com' });
      expect(user.passwordResetToken).toBeDefined();
      expect(user.passwordResetExpires).toBeDefined();
    });

    it('should not reveal if email does not exist', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Password reset link has been sent');
    });

    it('should require an email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Email is required');
    });
  });

  describe('Reset Password', () => {
    let resetToken;
    let user;

    beforeEach(async () => {
      // Create a test user
      user = await User.create({
        username: 'resetpass',
        email: 'reset@example.com',
        password: 'Password123!',
        firstName: 'Reset',
        lastName: 'Password'
      });

      // Generate reset token
      resetToken = user.generatePasswordResetToken();
      await user.save();
    });

    it('should reset password with valid token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          resetToken,
          newPassword: 'NewPassword789!'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Password has been reset successfully');

      // Verify password was updated
      const updatedUser = await User.findById(user._id).select('+password');
      const isMatch = await updatedUser.matchPassword('NewPassword789!');
      expect(isMatch).toBe(true);

      // Verify reset token was cleared
      expect(updatedUser.passwordResetToken).toBeUndefined();
      expect(updatedUser.passwordResetExpires).toBeUndefined();
    });

    it('should reject invalid reset tokens', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          resetToken: 'invalid-token',
          newPassword: 'NewPassword789!'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid or expired reset token');
    });

    it('should require reset token and new password', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          newPassword: 'NewPassword789!'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Reset token and new password are required');
    });
  });

  describe('Email Verification', () => {
    let verificationToken;
    let user;

    beforeEach(async () => {
      // Create a test user
      user = await User.create({
        username: 'verifyemail',
        email: 'verify@example.com',
        password: 'Password123!',
        firstName: 'Verify',
        lastName: 'Email',
        emailVerified: false
      });

      // Generate verification token
      verificationToken = user.generateEmailVerificationToken();
      await user.save();
    });

    it('should verify email with valid token', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ verificationToken });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Email verified successfully');

      // Verify email was marked as verified
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.emailVerified).toBe(true);
      expect(updatedUser.emailVerificationToken).toBeUndefined();
      expect(updatedUser.emailVerificationExpires).toBeUndefined();
    });

    it('should reject invalid verification tokens', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ verificationToken: 'invalid-token' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid or expired verification token');
    });

    it('should require verification token', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Verification token is required');
    });
  });

  describe('Resend Verification Email', () => {
    let token;
    let user;

    beforeEach(async () => {
      // Create a test user
      const result = await createUserWithTokens({
        emailVerified: false
      });
      token = result.tokens.token;
      user = result.user;
    });

    it('should resend verification email for unverified user', async () => {
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Verification email has been sent');
      expect(res.body.verificationToken).toBeDefined(); // Note: In production, this would not be returned

      // Verify token was updated
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.emailVerificationToken).toBeDefined();
      expect(updatedUser.emailVerificationExpires).toBeDefined();
    });

    it('should not resend if email is already verified', async () => {
      // Update user to verified
      await User.findByIdAndUpdate(user._id, { emailVerified: true });

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Email is already verified');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/auth/resend-verification');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});

/**
 * Helper function to create a user with authentication tokens
 */
async function createUserWithTokens(userData = {}) {
  const user = await User.create({
    username: 'testuser',
    email: 'test@example.com',
    password: 'Password123!',
    firstName: 'Test',
    lastName: 'User',
    ...userData
  });

  // Generate tokens
  const token = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken('127.0.0.1', 'Test User Agent');
  await user.save();

  return {
    user,
    tokens: {
      token,
      refreshToken
    }
  };
} 