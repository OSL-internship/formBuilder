import { describe, it, expect } from "vitest";
import { validatePattern, validateField } from "./validation.js";
describe("validatePattern", () => {
  it("returns null when pattern is empty", () => {
    expect(validatePattern("")).toBe(null);
  });

  it("accepts a valid safe pattern", () => {
    expect(validatePattern("^\\d+$")).toBe(null);
  });

  it("rejects patterns longer than 100 characters", () => {
    expect(validatePattern("a".repeat(101))).toBe(
      "Validation pattern is too long.",
    );
  });

  it("rejects an invalid regex pattern", () => {
    expect(validatePattern("[")).toBe(
      "The configured validation pattern is invalid.",
    );
  });

  it("rejects an unsafe regex pattern", () => {
    expect(validatePattern("(a+)+$")).toBe(
      "This validation pattern is not safe.",
    );
  });
});

describe("validateField", () => {
  it("returns required error for empty required field", () => {
    const field = {
      required: true,
      type: "Text",
    };

    expect(validateField(field, "")).toEqual(["This field is required."]);
  });

  it("uses custom required error message", () => {
    const field = {
      required: true,
      type: "Text",
      errorMessage: "Please enter your name.",
    };

    expect(validateField(field, "")).toEqual(["Please enter your name."]);
  });

  it("requires checkbox value to be true", () => {
    const field = {
      required: true,
      type: "Checkbox",
    };

    expect(validateField(field, false)).toEqual(["This field is required."]);
  });

  it("accepts checked required checkbox", () => {
    const field = {
      required: true,
      type: "Checkbox",
    };

    expect(validateField(field, true)).toEqual([]);
  });

  it("skips validation for optional empty fields", () => {
    const field = {
      required: false,
      type: "Email",
    };

    expect(validateField(field, "")).toEqual([]);
  });

  it("checks minimum length", () => {
    const field = {
      required: false,
      type: "Text",
      minLength: 5,
    };

    expect(validateField(field, "abc")).toContain("Minimum length is 5.");
  });

  it("checks maximum length", () => {
    const field = {
      required: false,
      type: "Text",
      maxLength: 5,
    };

    expect(validateField(field, "abcdefgh")).toContain("Maximum length is 5.");
  });

  it("checks minimum number value", () => {
    const field = {
      required: false,
      type: "Number",
      minValue: 18,
    };

    expect(validateField(field, 15)).toContain("Minimum value is 18.");
  });

  it("checks maximum number value", () => {
    const field = {
      required: false,
      type: "Number",
      maxValue: 60,
    };

    expect(validateField(field, 70)).toContain("Maximum value is 60.");
  });

  it("rejects invalid email", () => {
    const field = {
      required: false,
      type: "Email",
    };

    expect(validateField(field, "invalid-email")).toContain(
      "Enter a valid email.",
    );
  });

  it("accepts valid email", () => {
    const field = {
      required: false,
      type: "Email",
    };

    expect(validateField(field, "anjali@example.com")).toEqual([]);
  });

  it("rejects value that does not match regex", () => {
    const field = {
      required: false,
      type: "Text",
      pattern: "^\\d+$",
    };

    expect(validateField(field, "abc")).toContain("Value format is invalid.");
  });

  it("uses custom regex error message", () => {
    const field = {
      required: false,
      type: "Text",
      pattern: "^\\d+$",
      errorMessage: "Only numbers are allowed.",
    };

    expect(validateField(field, "abc")).toContain("Only numbers are allowed.");
  });

  it("rejects unsafe regex during field validation", () => {
    const field = {
      required: false,
      type: "Text",
      pattern: "(a+)+$",
    };

    expect(validateField(field, "aaaa")).toContain(
      "This validation pattern is not safe.",
    );
  });

  it("accepts valid input with all rules satisfied", () => {
    const field = {
      required: true,
      type: "Text",
      minLength: 3,
      maxLength: 10,
      pattern: "^[a-zA-Z]+$",
    };

    expect(validateField(field, "Anjali")).toEqual([]);
  });
});
