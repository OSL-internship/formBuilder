import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import authMiddleware from "../middleware/authMiddleware.js";
import process from "node:process";
import EmailVerification from "../models/EmailVerification.js";
import { validateEmail } from "../services/emailValidation.js";
import {
  generateAndSendOTP,
  hashOTP,
} from "../services/verificationService.js";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";
const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
});

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many signup attempts. Please try again after 15 minutes.",
  },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many OTP attempts. Please try again after 15 minutes.",
  },
});

const resendLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Please wait 60 seconds before requesting another OTP.",
  },
});

// Send OTP
router.post("/send-otp", signupLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    const normalizedEmail = await validateEmail(email);

    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

    if (!strongPassword.test(password)) {
      return res.status(400).json({
        message:
          "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character.",
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await generateAndSendOTP({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Send OTP error:", error.message);

    return res.status(400).json({
      message: error.message || "Unable to send verification code.",
    });
  }
});

// Verify OTP and create account
router.post("/verify-otp", otpLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email?.trim() || !otp) {
      return res.status(400).json({
        message: "Email and verification code are required.",
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: "Please enter a valid 6-digit OTP.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const verification = await EmailVerification.findOne({
      email: normalizedEmail,
    });

    if (!verification) {
      return res.status(404).json({
        message: "Verification request not found. Please sign up again.",
      });
    }

    const now = new Date();

    if (verification.blockedUntil && verification.blockedUntil > now) {
      return res.status(429).json({
        message: "Too many incorrect attempts. Try again after 12 hours.",
      });
    }

    if (verification.expiresAt <= now) {
      return res.status(400).json({
        message: "OTP has expired. Please request a new code.",
      });
    }

    const submittedHash = hashOTP(otp);

    const isValid = crypto.timingSafeEqual(
      Buffer.from(submittedHash, "hex"),
      Buffer.from(verification.otpHash, "hex"),
    );

    if (!isValid) {
      const updatedVerification = await EmailVerification.findOneAndUpdate(
        {
          _id: verification._id,
          attempts: { $lt: 3 },
        },
        {
          $inc: { attempts: 1 },
        },
        { new: true },
      );

      if (!updatedVerification) {
        return res.status(429).json({
          message: "Too many incorrect attempts. Try again after 12 hours.",
        });
      }

      if (updatedVerification.attempts >= 3) {
        const blockedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000);

        updatedVerification.blockedUntil = blockedUntil;
        updatedVerification.cleanupAt = new Date(
          blockedUntil.getTime() + 24 * 60 * 60 * 1000,
        );

        await updatedVerification.save();

        return res.status(429).json({
          message:
            "3 incorrect attempts. Verification is blocked for 12 hours.",
        });
      }

      return res.status(400).json({
        message: `Incorrect OTP. ${3 - updatedVerification.attempts} attempts remaining.`,
      });
    }

    // Create user only after successful email verification
    const user = await User.create({
      name: verification.name,
      email: verification.email,
      passwordHash: verification.passwordHash,
    });

    await EmailVerification.deleteOne({
      _id: verification._id,
    });

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured.");
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        tokenVersion: user.tokenVersion,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("formcraft_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(201).json({
      message: "Email verified and account created successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("OTP verification error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    return res.status(500).json({
      message: "Unable to verify email. Please try again.",
    });
  }
});

// Resend OTP
router.post("/resend-otp", resendLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email?.trim()) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const verification = await EmailVerification.findOne({
      email: normalizedEmail,
    });

    if (!verification) {
      return res.status(404).json({
        message: "Verification request not found. Please sign up again.",
      });
    }

    const result = await generateAndSendOTP({
      name: verification.name,
      email: verification.email,
      passwordHash: verification.passwordHash,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Resend OTP error:", error.message);

    return res.status(400).json({
      message: error.message || "Unable to resend verification code.",
    });
  }
});

// Signup
// router.post("/signup",signupLimiter, async (req, res) => {
//   try {
//     const { name, email, password } = req.body;

//     // Required fields
//     if (!name?.trim() || !email?.trim() || !password) {
//       return res.status(400).json({
//         message: "Name, email and password are required.",
//       });
//     }

//     // Validate email
//     const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//     if (!emailPattern.test(email.trim())) {
//       return res.status(400).json({
//         message: "Please enter a valid email address.",
//       });
//     }

//     // Validate password strength
//     const strongPassword =
//       /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

//     if (!strongPassword.test(password)) {
//       return res.status(400).json({
//         message:
//           "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character.",
//       });
//     }

//     const normalizedEmail = email.trim().toLowerCase();

//     // Check existing user
//     const existingUser = await User.findOne({
//       email: normalizedEmail,
//     });

//     if (existingUser) {
//       return res.status(409).json({
//         message: "An account with this email already exists.",
//       });
//     }

//     // Hash password
//     const passwordHash = await bcrypt.hash(password, 12);

//     // Create user
//     const user = await User.create({
//       name: name.trim(),
//       email: normalizedEmail,
//       passwordHash,
//     });

//     if (!process.env.JWT_SECRET) {
//       throw new Error("JWT_SECRET is not configured.");
//     }

//     const token = jwt.sign(
//       { userId: user._id.toString() ,
//        tokenVersion: user.tokenVersion},

//       process.env.JWT_SECRET,
//       { expiresIn: "1d" },
//     );

//     res.cookie("formcraft_token", token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "lax",
//       maxAge: 24 * 60 * 60 * 1000,
//       path: "/",
//     });

//     return res.status(201).json({
//       message: "Account created successfully.",
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//       },
//     });
//   } catch (error) {
//     if (error.code === 11000) {
//       return res.status(409).json({
//         message: "An account with this email already exists.",
//       });
//     }

//     console.error("Signup error:", error.message);

//     res.status(500).json({
//       message: "Unable to create account.",
//     });
//   }
// });

// Login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Fetch user and explicitly include passwordHash
    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+passwordHash");

    // Same error for unknown email and wrong password
    if (!user || !user.passwordHash) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured.");
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        tokenVersion: user.tokenVersion,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("formcraft_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.status(200).json({
      message: "Login successful.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      message: "Unable to log in. Please try again.",
    });
  }
});

router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        message: "Google credential is required.",
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Google authentication is not configured.",
      });
    }

    // Step 1: Verify Google ID token
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    let payload;

    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({
        message: "Invalid Google credential.",
      });
    }

    // Step 2: Check verified email
    if (!payload?.email || payload.email_verified !== true) {
      return res.status(401).json({
        message: "Google email is not verified.",
      });
    }

    const email = payload.email.toLowerCase();

    // Step 3: Find account using Google ID first
    let user = await User.findOne({
      googleId: payload.sub,
    });

    if (!user) {
      // Step 4: Check whether this email already has an account
      user = await User.findOne({ email });

      if (user) {
        // Prevent linking a different Google account to an already linked account
        if (user.googleId && user.googleId !== payload.sub) {
          return res.status(409).json({
            message: "This email is linked to another Google account.",
          });
        }

        // Link Google account to existing account
        user.googleId = payload.sub;
        await user.save();
      } else {
        // Step 5: Create a new Google user
        user = await User.create({
          name: payload.name || email.split("@")[0],
          email,
          googleId: payload.sub,
        });
      }
    }

    // Step 6: Generate FormCraft JWT
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        tokenVersion: user.tokenVersion,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    // Step 7: Set HTTP-only cookie
    res.cookie("formcraft_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      message: "Google sign-in successful.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Google sign-in error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    return res.status(500).json({
      message: "Google sign-in failed. Please try again.",
    });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const token = req.cookies?.formcraft_token;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        await User.findByIdAndUpdate(decoded.userId, {
          $inc: { tokenVersion: 1 },
        });
      } catch {
        console.log("Logout attempted with an invalid or expired token.");
      }
    }

    res.clearCookie("formcraft_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.status(200).json({
      message: "Logout successful.",
    });
  } catch (error) {
    console.error("Logout error:", error.message);

    return res.status(500).json({
      message: "Unable to log out. Please try again.",
    });
  }
});

// Get currently logged-in user
router.get("/me", authMiddleware, (req, res) => {
  res.status(200).json({
    user: req.user,
  });
});

export default router;
