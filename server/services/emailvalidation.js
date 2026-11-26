import validator from "validator";
import { resolveMx, resolve4 } from "node:dns/promises";

export async function validateEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!validator.isEmail(normalizedEmail)) {
    throw new Error("Please enter a valid email address.");
  }

  const domain = normalizedEmail.split("@")[1];

  try {
    const mxRecords = await resolveMx(domain);
    if (mxRecords.length > 0) return normalizedEmail;
  } catch (error) {
    if (error.code !== "ENODATA" && error.code !== "ENOTFOUND") {
      throw error;
    }
  }

  try {
    const addresses = await resolve4(domain);
    if (addresses.length > 0) return normalizedEmail;
  } catch (error) {
    if (error.code !== "ENODATA" && error.code !== "ENOTFOUND") {
      throw error;
    }
  }

  throw new Error("This email domain cannot receive emails.");
}