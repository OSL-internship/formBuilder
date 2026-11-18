import { describe, it, expect } from "vitest";
import { getVisibleFields } from "./conditions.js";

describe("getVisibleFields", () => {
  it("should return all fields when no conditions exist", () => {
    const fields = [
      { id: "1", name: "name" },
      { id: "2", name: "email" },
    ];

    expect(getVisibleFields(fields, {})).toEqual(fields);
  });

  it("should show field when equals condition matches", () => {
    const fields = [
      { id: "1", name: "country" },
      {
        id: "2",
        name: "state",
        conditions: [
          { fieldId: "1", operator: "equals", value: "India" },
        ],
      },
    ];

    expect(getVisibleFields(fields, { country: "India" })).toHaveLength(2);
  });

  it("should hide field when equals condition does not match", () => {
    const fields = [
      { id: "1", name: "country" },
      {
        id: "2",
        name: "state",
        conditions: [
          { fieldId: "1", operator: "equals", value: "India" },
        ],
      },
    ];

    expect(getVisibleFields(fields, { country: "USA" })).toHaveLength(1);
  });

  it("should support notEquals condition", () => {
    const fields = [
      { id: "1", name: "country" },
      {
        id: "2",
        name: "state",
        conditions: [
          { fieldId: "1", operator: "notEquals", value: "USA" },
        ],
      },
    ];

    expect(getVisibleFields(fields, { country: "India" })).toHaveLength(2);
  });

  it("should support contains for string values", () => {
    const fields = [
      { id: "1", name: "city" },
      {
        id: "2",
        name: "area",
        conditions: [
          { fieldId: "1", operator: "contains", value: "Allahabad" },
        ],
      },
    ];

    expect(getVisibleFields(fields, { city: "Prayagraj Allahabad" })).toHaveLength(2);
  });

  it("should support contains for array values", () => {
    const fields = [
      { id: "1", name: "skills" },
      {
        id: "2",
        name: "experience",
        conditions: [
          { fieldId: "1", operator: "contains", value: "React" },
        ],
      },
    ];

    expect(getVisibleFields(fields, { skills: ["React", "Node"] })).toHaveLength(2);
  });

  it("should support greaterThan and lessThan conditions", () => {
    const fields = [
      { id: "1", name: "age" },
      {
        id: "2",
        name: "adult",
        conditions: [
          { fieldId: "1", operator: "greaterThan", value: 18 },
        ],
      },
      {
        id: "3",
        name: "minor",
        conditions: [
          { fieldId: "1", operator: "lessThan", value: 18 },
        ],
      },
    ];

    const result = getVisibleFields(fields, { age: 20 });

    expect(result.map((field) => field.name)).toContain("adult");
    expect(result.map((field) => field.name)).not.toContain("minor");
  });

  it("should handle empty values in numeric conditions", () => {
    const fields = [
      { id: "1", name: "age" },
      {
        id: "2",
        name: "adult",
        conditions: [
          { fieldId: "1", operator: "greaterThan", value: 18 },
        ],
      },
    ];

    expect(getVisibleFields(fields, { age: "" })).toHaveLength(1);
  });

  it("should support isEmpty condition", () => {
    const fields = [
      { id: "1", name: "name" },
      {
        id: "2",
        name: "details",
        conditions: [
          { fieldId: "1", operator: "isEmpty" },
        ],
      },
    ];

    expect(getVisibleFields(fields, { name: "" })).toHaveLength(2);
    expect(getVisibleFields(fields, { name: "Anjali" })).toHaveLength(1);
  });

  it("should hide field when source field does not exist", () => {
    const fields = [
      {
        id: "2",
        name: "state",
        conditions: [
          { fieldId: "missing", operator: "equals", value: "India" },
        ],
      },
    ];

    expect(getVisibleFields(fields, {})).toHaveLength(0);
  });

  it("should support OR condition logic", () => {
    const fields = [
      { id: "1", name: "country" },
      { id: "2", name: "role" },
      {
        id: "3",
        name: "details",
        conditionLogic: "OR",
        conditions: [
          { fieldId: "1", operator: "equals", value: "India" },
          { fieldId: "2", operator: "equals", value: "Admin" },
        ],
      },
    ];

    expect(
      getVisibleFields(fields, { country: "USA", role: "Admin" }),
    ).toHaveLength(3);
  });

  it("should use AND logic by default", () => {
    const fields = [
      { id: "1", name: "country" },
      { id: "2", name: "role" },
      {
        id: "3",
        name: "details",
        conditions: [
          { fieldId: "1", operator: "equals", value: "India" },
          { fieldId: "2", operator: "equals", value: "Admin" },
        ],
      },
    ];

    expect(
      getVisibleFields(fields, { country: "India", role: "User" }),
    ).toHaveLength(2);
  });

  it("should handle hidden source fields with isEmpty condition", () => {
    const fields = [
      {
        id: "1",
        name: "state",
        conditions: [
          { fieldId: "missing", operator: "equals", value: "India" },
        ],
      },
      {
        id: "2",
        name: "city",
        conditions: [
          { fieldId: "1", operator: "isEmpty" },
        ],
      },
    ];

    expect(getVisibleFields(fields, {})).toHaveLength(1);
    expect(getVisibleFields(fields, {})[0].name).toBe("city");
  });

  it("should prevent circular conditions", () => {
    const fields = [
      {
        id: "1",
        name: "country",
        conditions: [
          { fieldId: "2", operator: "equals", value: "India" },
        ],
      },
      {
        id: "2",
        name: "state",
        conditions: [
          { fieldId: "1", operator: "equals", value: "UP" },
        ],
      },
    ];

    expect(getVisibleFields(fields, {})).toEqual([]);
  });

  it("should handle unknown operators", () => {
    const fields = [
      { id: "1", name: "country" },
      {
        id: "2",
        name: "state",
        conditions: [
          { fieldId: "1", operator: "unknown", value: "India" },
        ],
      },
    ];

    expect(getVisibleFields(fields, { country: "India" })).toHaveLength(1);
  });
});
