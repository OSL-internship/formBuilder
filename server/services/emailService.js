import nodemailer from "nodemailer";
import "dotenv/config";
import process from "node:process";
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Send email verification OTP
export async function sendVerificationEmail(email, otp) {
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Verify your FormCraft email",
    text: `Your FormCraft verification code is ${otp}. It expires in 60 seconds.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
        <h2>Verify your email</h2>
        <p>Use the following code to verify your FormCraft account:</p>

        <h1 style="letter-spacing: 8px;">${otp}</h1>

        <p>This code expires in 60 seconds.</p>
        <p>If you did not request this code, you can ignore this email.</p>
      </div>
    `,
  });

  // Show preview link only during development
  if (process.env.NODE_ENV !== "production") {
    console.log("Email preview:", nodemailer.getTestMessageUrl(info));
  }
}
