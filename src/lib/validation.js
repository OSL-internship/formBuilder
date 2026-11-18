import safeRegex from "safe-regex2";
export function validatePattern(pattern) {
  if (!pattern) return null;

  if (pattern.length > 100) {
    return "Validation pattern is too long.";
  }

  try {
    const regex = new RegExp(pattern);

    if (!safeRegex(regex)) {
      return "This validation pattern is not safe.";
    }
  } catch {
    return "The configured validation pattern is invalid.";
  }

  return null;
}

export function validateField(field, value) {
  const errors = [];
  const empty =
    value === undefined || value === null || String(value).trim() === "";

  if (
    field.required &&
    (empty || (field.type === "Checkbox" && value !== true))
  ) {
    errors.push(field.errorMessage || "This field is required.");
    return errors;
  }

  // Optional empty fields ko validate nahi karna.
  if (empty) return errors;

  const text = String(value);

  if (
    field.minLength !== "" &&
    field.minLength != null &&
    text.length < Number(field.minLength)
  ) {
    errors.push(`Minimum length is ${field.minLength}.`);
  }

  if (
    field.maxLength !== "" &&
    field.maxLength != null &&
    text.length > Number(field.maxLength)
  ) {
    errors.push(`Maximum length is ${field.maxLength}.`);
  }

  if (field.type === "Number") {
    const number = Number(value);

    if (
      field.minValue !== "" &&
      field.minValue != null &&
      number < Number(field.minValue)
    ) {
      errors.push(`Minimum value is ${field.minValue}.`);
    }

    if (
      field.maxValue !== "" &&
      field.maxValue != null &&
      number > Number(field.maxValue)
    ) {
      errors.push(`Maximum value is ${field.maxValue}.`);
    }
  }

  if (field.type === "Email") {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(text)) {
      errors.push("Enter a valid email.");
    }
  }

  if (field.pattern) {
  const patternError = validatePattern(field.pattern);

  if (patternError) {
    errors.push(patternError);
  } else {
    const regex = new RegExp(field.pattern);

    if (!regex.test(text)) {
      errors.push(field.errorMessage || "Value format is invalid.");
    }
  }
}

  return errors;
}
