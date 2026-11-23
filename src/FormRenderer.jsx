import { getIn, useFormikContext } from "formik";
import { getVisibleFields } from "../shared/conditionEvaluator";

import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";

import { Checkbox } from "./components/ui/checkbox";

import { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";

function FormRenderer({ schema, onValueChange }) {
  const { values, errors, touched, setFieldValue, setFieldTouched } =
    useFormikContext();

  function updateValue(name, value) {
    setFieldValue(name, value);
    onValueChange?.(name, value);
  }

  const fields = schema?.fields || [];

  const effectiveValues = Object.fromEntries(
    fields.map((field) => [
      field.name,
      getIn(values, field.name) ??
        field.defaultValue ??
        (field.type === "Checkbox" ? false : ""),
    ]),
  );

  const visibleFields = getVisibleFields(fields, effectiveValues);

  function renderField(field) {
    const value =
      getIn(values, field.name) ??
      field.defaultValue ??
      (field.type === "Checkbox" ? false : "");

    const fieldError = getIn(errors, field.name);

    const errorMessages = Array.isArray(fieldError)
      ? fieldError
      : fieldError
        ? [fieldError]
        : [];

    const hasError =
      Boolean(getIn(touched, field.name)) && errorMessages.length > 0;

    const describedBy =
      [
        field.helpText ? `${field.id}-help` : null,
        hasError ? `${field.id}-error` : null,
      ]
        .filter(Boolean)
        .join(" ") || undefined;

    const commonProps = {
      id: field.id,
      name: field.name,
      placeholder: field.placeholder || field.label,
      required: field.required,
      "aria-invalid": hasError,
      "aria-describedby": describedBy,
      onBlur: () => setFieldTouched(field.name, true),
    };

    switch (field.type) {
      case "Text":
      case "Email":
      case "Number":
      case "Date":
        return (
          <Input
            {...commonProps}
            type={field.type.toLowerCase()}
            value={value}
            className="mt-2 w-full"
            onChange={(e) => updateValue(field.name, e.target.value)}
          />
        );

      case "Textarea":
        return (
          <Textarea
            {...commonProps}
            rows={3}
            value={value}
            className="mt-2 w-full"
            onChange={(e) => updateValue(field.name, e.target.value)}
          />
        );

      case "Select":
        return (
          <Select
            name={field.name}
            value={value || null}
            onValueChange={(nextValue) => updateValue(field.name, nextValue)}
          >
            <SelectTrigger
              id={field.id}
              className="mt-2 w-full"
              aria-invalid={hasError}
              aria-describedby={describedBy}
              onBlur={() => setFieldTouched(field.name, true)}
            >
              <SelectValue
                placeholder={field.placeholder || "Select an option"}
              />
            </SelectTrigger>

            <SelectContent>
              {(field.options || []).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "Checkbox":
        return (
          <div className="mt-2 flex items-center gap-2">
            <Checkbox
              {...commonProps}
              checked={value === true || value === "true"}
              onCheckedChange={(checked) => updateValue(field.name, checked)}
            />

            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span aria-hidden="true"> *</span>}
            </Label>
          </div>
        );

      case "Radio Group":
        return (
          <RadioGroup
            value={value || ""}
            onValueChange={(nextValue) => updateValue(field.name, nextValue)}
            onBlur={() => setFieldTouched(field.name, true)}
            aria-invalid={hasError}
            aria-describedby={describedBy}
            className="mt-2"
          >
            {(field.options || []).map((option, index) => {
              const optionId = `${field.id}-option-${index}`;

              return (
                <div key={optionId} className="flex items-center gap-2">
                  <RadioGroupItem id={optionId} value={option} />

                  <Label htmlFor={optionId}>{option}</Label>
                </div>
              );
            })}
          </RadioGroup>
        );

      default:
        return null;
    }
  }

  return (
    <div className="space-y-4">
      {visibleFields.map((field) => {
        const fieldError = getIn(errors, field.name);

        const errorMessages = Array.isArray(fieldError)
          ? fieldError
          : fieldError
            ? [fieldError]
            : [];

        const showError =
          Boolean(getIn(touched, field.name)) && errorMessages.length > 0;

        return (
          <div key={field.id}>
            {field.type !== "Checkbox" && (
              <Label
                htmlFor={field.type === "Radio Group" ? undefined : field.id}
                className="block"
              >
                {field.label}
                {field.required && <span aria-hidden="true"> *</span>}
              </Label>
            )}

            {renderField(field)}

            {field.helpText && (
              <p
                id={`${field.id}-help`}
                className="mt-1 text-sm text-muted-foreground"
              >
                {field.helpText}
              </p>
            )}

            {showError && (
              <p
                id={`${field.id}-error`}
                className="mt-1 text-sm text-destructive"
                role="alert"
              >
                {errorMessages.join(", ")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default FormRenderer;
