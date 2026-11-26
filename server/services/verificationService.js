import crypto from "node:crypto";
import EmailVerification from "../models/EmailVerification.js";
import { sendVerificationEmail } from "./emailService.js";
import process from "node:process";
// Generate a secure 6-digit OTP
export function generateOTP() {
    return crypto.randomInt(100000, 1000000).toString();
}

// Hash OTP using HMAC
export function hashOTP(otp) {
    const secret = process.env.OTP_SECRET;

    if (!secret) {
        throw new Error("OTP_SECRET is not configured.");
    }

    return crypto.createHmac("sha256", secret).update(otp).digest("hex");
}

// Generate OTP, save its hash and send email
export async function generateAndSendOTP({ name, email, passwordHash }) {
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    let verification = await EmailVerification.findOne({
        email: normalizedEmail,
    });

    // Do not allow OTP generation during 12-hour lockout
    if (verification?.blockedUntil && verification.blockedUntil > now) {
        throw new Error("Too many incorrect attempts. Try again after 12 hours.");
    }

    const otp = generateOTP();
    const otpHash = hashOTP(otp);

    const expiresAt = new Date(now.getTime() + 60 * 1000);

    // Keep record long enough for the lockout period
    const cleanupAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    if (!verification) {
        verification = new EmailVerification({
            name,
            email: normalizedEmail,
            passwordHash,
            otpHash,
            expiresAt,
            attempts: 0,
            blockedUntil: null,
            cleanupAt,
        });
    } else {
        verification.name = name;
        verification.passwordHash = passwordHash;
        verification.otpHash = otpHash;
        verification.expiresAt = expiresAt;
        verification.attempts = 0;
        verification.blockedUntil = null;
        verification.cleanupAt = cleanupAt;
    }

    await verification.save();

    try {
        await sendVerificationEmail(normalizedEmail, otp);
    } catch (error) {
        console.error("SMTP ERROR:", error.message);
        console.error("SMTP ERROR CODE:", error.code);

        await EmailVerification.deleteOne({ _id: verification._id });

        throw new Error("Unable to send verification email. Please try again.", {
            cause: error,
        });
    }

    return {
        message: "Verification code sent to your email.",
    };
}
