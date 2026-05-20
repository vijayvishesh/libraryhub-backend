import rateLimit from 'express-rate-limit';

export const otpRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: req => (req.body?.phone as string) || req.ip || 'unknown',
  message: { responseCode: 429, message: 'TOO_MANY_OTP_REQUESTS' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpVerifyRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: req => (req.body?.phone as string) || req.ip || 'unknown',
  message: { responseCode: 429, message: 'TOO_MANY_VERIFY_ATTEMPTS' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: req => (req.body?.phone as string) || req.ip || 'unknown',
  message: { responseCode: 429, message: 'TOO_MANY_LOGIN_ATTEMPTS' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { responseCode: 429, message: 'TOO_MANY_REQUESTS' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicEndpointRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { responseCode: 429, message: 'TOO_MANY_REQUESTS' },
  standardHeaders: true,
  legacyHeaders: false,
});
