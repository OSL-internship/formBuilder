export function getVisibleFields(fields, values) {
  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const visibilityCache = new Map();

  function checkVisibility(field, visited = new Set()) {
    if (visibilityCache.has(field.id)) {
      return visibilityCache.get(field.id);
    }

    if (visited.has(field.id)) return false;

    if (!field.conditions?.length) {
      visibilityCache.set(field.id, true);
      return true;
    }

    const currentPath = new Set(visited);
    currentPath.add(field.id);

    const checkCondition = (condition) => {
      const sourceField = fieldMap.get(condition.fieldId);

      if (!sourceField) return false;

      const sourceVisible = checkVisibility(sourceField, currentPath);

      if (!sourceVisible) {
        return condition.operator === "isEmpty";
      }

      const actual = values[sourceField.name] ?? sourceField.defaultValue ?? "";
      const expected = condition.value ?? "";

      switch (condition.operator) {
        case "equals":
          return String(actual) === String(expected);
        case "notEquals":
          return String(actual) !== String(expected);
        case "contains":
          return Array.isArray(actual)
            ? actual.includes(expected)
            : String(actual).includes(String(expected));
        case "greaterThan":
          return actual !== "" && Number(actual) > Number(expected);
        case "lessThan":
          return actual !== "" && Number(actual) < Number(expected);
        case "isEmpty":
          return actual == null || String(actual).trim() === "";
        default:
          return false;
      }
    };

    const isVisible =
      field.conditionLogic === "OR"
        ? field.conditions.some(checkCondition)
        : field.conditions.every(checkCondition);

    visibilityCache.set(field.id, isVisible);
    return isVisible;
  }

  return fields.filter((field) => checkVisibility(field));
}
