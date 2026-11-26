import { Formik, Form } from "formik";
import { Button, buttonVariants } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { Checkbox } from "./components/ui/checkbox";
import { useAuth } from "./context/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";
import { useEffect, useState } from "react";
import { apiRequest } from "./services/api";
import { validateField, validatePattern } from "../shared/validation";
import { getVisibleFields } from "../shared/conditionEvaluator";
import { Routes, Route } from "react-router-dom";
import PublishedFormPage from "./PublishedFormPage";
import FormRenderer from "./FormRenderer";
import Auth from "./Auth";
import ProtectedRoute from "./components/ProtectedRoute";
import { useNavigate } from "react-router-dom";
const fieldTypes = [
  "Text",
  "Textarea",
  "Number",
  "Email",
  "Select",
  "Radio Group",
  "Checkbox",
  "Date",
];

function App() {
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [isPreview, setIsPreview] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [errors, setErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [importError, setImportError] = useState("");
  const [draggedFieldId, setDraggedFieldId] = useState(null);
  const [formTitle, setFormTitle] = useState("Untitled Form");
  const [formId, setFormId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [savedForms, setSavedForms] = useState([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [formStatus, setFormStatus] = useState("draft");

  const [draggedFieldType, setDraggedFieldType] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [saveMessageType, setSaveMessageType] = useState("");
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!saveMessage) return;

    const timer = setTimeout(() => {
      setSaveMessage("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [saveMessage]);

  // useEffect(() => {
  //   fetchSavedForms();
  // }, []);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedForms([]);
      handleNewForm();
      return;
    }

    handleNewForm();
    setSavedForms([]);
    fetchSavedForms();
  }, [user, loading]);

  function addField(type) {
    const baseName = type.toLowerCase().replaceAll(" ", "_");
    let suffix = 1;
    let fieldName = `${baseName}_${suffix}`;
    while (fields.some((field) => field.name === fieldName)) {
      suffix++;
      fieldName = `${baseName}_${suffix}`;
    }

    const newField = {
      id: crypto.randomUUID(),
      type,
      label: type,
      name: fieldName,
      placeholder: "",
      defaultValue: "",
      helpText: "",
      required: false,
      options: ["Option 1", "Option 2"],
      minLength: "",
      maxLength: "",
      minValue: "",
      maxValue: "",
      pattern: "",
      errorMessage: "",
      conditions: [],
    };

    setFields((currentFields) => [...currentFields, newField]);
    setSelectedFieldId(newField.id);
  }

  const selectedField = fields.find((field) => field.id === selectedFieldId);

  function updateSelectedField(property, value) {
    if (property === "conditions") {
      setImportError("");
      const selectedField = fields.find(
        (field) => field.id === selectedFieldId,
      );

      if (!selectedField) return;

      const createsCycle = (fieldId, visited = new Set()) => {
        if (fieldId === selectedFieldId) return true;
        if (visited.has(fieldId)) return false;

        visited.add(fieldId);

        const field = fields.find((item) => item.id === fieldId);
        if (!field) return false;

        return (field.conditions || []).some((condition) =>
          createsCycle(condition.fieldId, new Set(visited)),
        );
      };

      const hasCycle = value.some(
        (condition) => condition.fieldId && createsCycle(condition.fieldId),
      );

      if (hasCycle) {
        setImportError(
          "Circular condition detected. Please choose another field.",
        );
        return;
      }
    }

    setFields((currentFields) =>
      currentFields.map((field) =>
        field.id === selectedFieldId ? { ...field, [property]: value } : field,
      ),
    );
  }

  function deleteSelectedField() {
    const dependentFields = fields.filter((field) =>
      field.conditions?.some(
        (condition) => condition.fieldId === selectedFieldId,
      ),
    );

    if (dependentFields.length > 0) {
      const names = dependentFields.map((field) => field.label).join(", ");

      const confirmed = window.confirm(
        `These fields depend on this field: ${names}. Delete it and remove their conditions?`,
      );

      if (!confirmed) return;
    }

    setFields((currentFields) =>
      currentFields
        .filter((field) => field.id !== selectedFieldId)
        .map((field) => ({
          ...field,
          conditions: (field.conditions || []).filter(
            (condition) => condition.fieldId !== selectedFieldId,
          ),
        })),
    );

    setSelectedFieldId(null);
    setImportError("");
  }

  async function handleDeleteForm(id) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this form?",
    );

    if (!confirmDelete) return;

    try {
      await apiRequest(`/forms/${id}`, {
        method: "DELETE",
      });

      setSaveMessage("Form deleted successfully!");

      if (formId === id) {
        handleNewForm();
      }

      await fetchSavedForms();
    } catch (error) {
      setSaveMessage(error.message);
    }
  }

  function renderField(field) {
    const commonProps = {
      id: field.id,
      "aria-invalid": errors[field.name]?.length > 0,
      "aria-describedby":
        errors[field.name]?.length > 0
          ? `${field.id}-error`
          : field.helpText
            ? `${field.id}-help`
            : undefined,
      name: field.name,
      placeholder: field.placeholder || field.label,
      value: formValues[field.name] ?? field.defaultValue ?? "",
      required: field.required,
      onChange: (e) => {
        const value = e.target.value;

        updateFormValue(field.name, value);

        if (touchedFields[field.name]) {
          const fieldErrors = validateField(field, value);

          setErrors((currentErrors) => {
            const updatedErrors = { ...currentErrors };

            if (fieldErrors.length > 0) {
              updatedErrors[field.name] = fieldErrors;
            } else {
              delete updatedErrors[field.name];
            }

            return updatedErrors;
          });
        }
      },
      onBlur: () => {
        setTouchedFields((current) => ({
          ...current,
          [field.name]: true,
        }));

        validateOneField(field);
      },
      className: "mt-2 w-full rounded-lg border border-slate-300 p-2",
    };

    const fieldLabel = (
      <Label htmlFor={field.id} className="block font-medium">
        {field.label}
        {field.required && <span aria-hidden="true"> *</span>}
      </Label>
    );

    switch (field.type) {
      case "Text":
        return (
          <>
            {fieldLabel}
            <Input type="text" {...commonProps} />
          </>
        );

      case "Email":
        return (
          <>
            {fieldLabel}
            <Input type="email" {...commonProps} />
          </>
        );
      case "Number":
        return (
          <>
            {fieldLabel}
            <Input type="number" {...commonProps} />
          </>
        );
      case "Textarea":
        return (
          <>
            {fieldLabel}
            <Textarea {...commonProps} rows={3} />
          </>
        );
      case "Date":
        return (
          <>
            {fieldLabel}
            <Input
              type="date"
              {...commonProps}
              className={commonProps.className}
            />
          </>
        );
      case "Checkbox":
        return (
          <div className="mt-2 flex items-center gap-2">
            <Checkbox
              id={field.id}
              name={field.name}
              checked={
                formValues[field.name] !== undefined
                  ? formValues[field.name] === true ||
                  formValues[field.name] === "true"
                  : field.defaultValue === true || field.defaultValue === "true"
              }
              required={field.required}
              aria-invalid={errors[field.name]?.length > 0}
              aria-describedby={
                errors[field.name]?.length > 0
                  ? `${field.id}-error`
                  : field.helpText
                    ? `${field.id}-help`
                    : undefined
              }
              onCheckedChange={(checked) => {
                updateFormValue(field.name, checked);

                if (touchedFields[field.name]) {
                  const updatedErrors = validateField(field, checked);

                  setErrors((current) => ({
                    ...current,
                    [field.name]: updatedErrors,
                  }));
                }
              }}
              onBlur={() => {
                setTouchedFields((current) => ({
                  ...current,
                  [field.name]: true,
                }));
                validateOneField(field);
              }}
            />

            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span aria-hidden="true"> *</span>}
            </Label>
          </div>
        );

      case "Select":
        return (
          <>
            {fieldLabel}
            <select
              name={field.name}
              id={field.id}
              aria-invalid={errors[field.name]?.length > 0}
              aria-describedby={
                errors[field.name]?.length > 0
                  ? `${field.id}-error`
                  : field.helpText
                    ? `${field.id}-help`
                    : undefined
              }
              value={formValues[field.name] ?? ""}
              onChange={(e) => {
                const value = e.target.value;

                updateFormValue(field.name, value);

                if (touchedFields[field.name]) {
                  const fieldErrors = validateField(field, value);

                  setErrors((current) => ({
                    ...current,
                    [field.name]: fieldErrors,
                  }));
                }
              }}
              onBlur={() => {
                setTouchedFields((current) => ({
                  ...current,
                  [field.name]: true,
                }));
                validateOneField(field);
              }}
              required={field.required}
              className={commonProps.className}
            >
              <option value="">Select an option</option>

              {(field.options || []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </>
        );

      case "Radio Group":
        return (
          <div className="mt-2 space-y-2">
            <p id={`${field.id}-label`} className="font-medium">
              {field.label}
              {field.required && <span aria-hidden="true"> *</span>}
            </p>

            <RadioGroup
              name={field.name}
              value={
                formValues[field.name] !== undefined
                  ? formValues[field.name]
                  : field.defaultValue || ""
              }
              required={field.required}
              aria-labelledby={`${field.id}-label`}
              aria-invalid={errors[field.name]?.length > 0}
              aria-describedby={
                errors[field.name]?.length > 0
                  ? `${field.id}-error`
                  : field.helpText
                    ? `${field.id}-help`
                    : undefined
              }
              onValueChange={(nextValue) => {
                updateFormValue(field.name, nextValue);

                if (touchedFields[field.name]) {
                  const updatedErrors = validateField(field, nextValue);

                  setErrors((current) => ({
                    ...current,
                    [field.name]: updatedErrors,
                  }));
                }
              }}
              className="flex flex-col gap-2"
            >
              {field.options.map((option, index) => {
                const optionId = `${field.id}-option-${index}`;

                return (
                  <div key={optionId} className="flex items-center gap-2">
                    <RadioGroupItem
                      id={optionId}
                      value={option}
                      onBlur={() => {
                        setTouchedFields((current) => ({
                          ...current,
                          [field.name]: true,
                        }));
                        validateOneField(field);
                      }}
                    />

                    <Label htmlFor={optionId}>{option}</Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>
        );
      default:
        return null;
    }
  }

  function updateFormValue(name, value) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));
  }

  // function handlePreviewValueChange(name, value) {
  //   updateFormValue(name, value);

  //   const field = fields.find((item) => item.name === name);

  //   if (field && touchedFields[name]) {
  //     validateOneField(field, value);
  //   }
  // }

  // function handlePreviewFieldBlur(field) {
  //   setTouchedFields((current) => ({
  //     ...current,
  //     [field.name]: true,
  //   }));

  //   validateOneField(field);
  // }

  async function handleSaveForm() {
    if (!formTitle.trim()) {
      setSaveMessage("Please enter a form title.");
      setSaveMessageType("error");
      return;
    }

    const invalidPatternField = fields.find(
      (field) => field.pattern && validatePattern(field.pattern),
    );

    if (invalidPatternField) {
      const patternError = validatePattern(invalidPatternField.pattern);

      setSaveMessage(
        `${invalidPatternField.label || invalidPatternField.name}: ${patternError}`,
      );
      setSaveMessageType("error");
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage("");
      setSaveMessageType("");

      const data = await apiRequest(formId ? `/forms/${formId}` : "/forms", {
        method: formId ? "PUT" : "POST",
        body: JSON.stringify({
          title: formTitle,
          fields,
        }),
      });

      const savedForm = data.form || data;
      setFormId(savedForm._id || savedForm.id);

      if (savedForm.status) {
        setFormStatus(savedForm.status);
      }

      setSaveMessage("Form saved successfully!");
      setSaveMessageType("success");
    } catch (error) {
      const message = error.field
        ? `${error.field}: ${error.message}`
        : error.message;

      setSaveMessage(message);
      setSaveMessageType("error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublishForm() {
    if (!formId) {
      setSaveMessage("Please save the form before publishing.");
      setSaveMessageType("error");
      return;
    }

    try {
      setIsPublishing(true);
      setSaveMessage("");
      setSaveMessageType("");

      const data = await apiRequest(`/forms/${formId}/publish`, {
        method: "PATCH",
      });

      setFormStatus(data.form?.status || "published");
      setSaveMessage("Form published successfully!");
      setSaveMessageType("success");

      await fetchSavedForms();
    } catch (error) {
      const message = error.field
        ? `${error.field}: ${error.message}`
        : error.message;

      setSaveMessage(message);
      setSaveMessageType("error");
    } finally {
      setIsPublishing(false);
    }
  }

  function handleNewForm() {
    setFormId(null);
    setFormStatus("draft");
    setFormTitle("");
    setFields([]);
    setSelectedFieldId(null);
    setSaveMessage("");
    // setSavedForms([]);
  }

  async function handleCopyLink(id) {
    const url = `${window.location.origin}/forms/${id}`;

    try {
      await navigator.clipboard.writeText(url);
      setSaveMessage("Form link copied successfully!");
    } catch {
      setSaveMessage("Unable to copy form link.");
    }
  }

  async function fetchSavedForms() {
    try {
      const data = await apiRequest("/forms");
      setSavedForms(data.forms || data);
    } catch (error) {
      setSaveMessage(error.message);
    }
  }

  async function handleLoadForm(id) {
    if (fields.length > 0) {
      if (
        !window.confirm(
          "Loading this form will replace your current work. Do you want to continue?",
        )
      ) {
        return;
      }
    }

    try {
      const data = await apiRequest(`/forms/${id}`);
      const form = data.form || data;

      setFormId(form._id);
      setFormTitle(form.title);
      setFormStatus(form.status || "draft");
      setFields(form.fields);
      setSelectedFieldId(null);
      setFormValues({});
      setErrors({});
      setSubmittedData(null);
      setIsPreview(false);
      setSaveMessage("Form loaded successfully!");
    } catch (error) {
      setSaveMessage(error.message);
    }
  }

  // function handleSubmit(e) {
  //   e.preventDefault();

  //   const newErrors = {};

  //   // Only validate visible fields
  //   visibleFields.forEach((field) => {
  //     const value = formValues[field.name] ?? field.defaultValue ?? "";
  //     const fieldErrors = validateField(field, value);

  //     if (fieldErrors.length > 0) {
  //       newErrors[field.name] = fieldErrors;
  //     }
  //   });

  //   setErrors(newErrors);

  //   if (Object.keys(newErrors).length > 0) {
  //     setSubmittedData(null);
  //     return;
  //   }

  //   // Submit only visible field values
  //   const submittedValues = Object.fromEntries(
  //     visibleFields.map((field) => [
  //       field.name,
  //       formValues[field.name] ?? field.defaultValue ?? "",
  //     ]),
  //   );

  //   setSubmittedData(submittedValues);
  // }

  function validateOneField(
    field,
    value = formValues[field.name] ??
      field.defaultValue ??
      (field.type === "Checkbox" ? false : ""),
  ) {
    const fieldErrors = validateField(field, value);

    setErrors((currentErrors) => {
      const updatedErrors = { ...currentErrors };

      if (fieldErrors.length > 0) {
        updatedErrors[field.name] = fieldErrors;
      } else {
        delete updatedErrors[field.name];
      }

      return updatedErrors;
    });
  }

  function exportJSON() {
    const schema = {
      title: formTitle,
      fields,
    };

    const json = JSON.stringify(schema, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "formcraft-schema.json";
    link.click();

    URL.revokeObjectURL(url);
  }

  function importJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError("");

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const schema = JSON.parse(reader.result);

        if (
          !schema ||
          typeof schema !== "object" ||
          Array.isArray(schema) ||
          !Array.isArray(schema.fields)
        ) {
          throw new Error("Invalid schema format.");
        }

        const validTypes = [
          "Text",
          "Textarea",
          "Number",
          "Email",
          "Select",
          "Radio Group",
          "Checkbox",
          "Date",
        ];

        const validOperators = [
          "equals",
          "notEquals",
          "contains",
          "greaterThan",
          "lessThan",
          "isEmpty",
        ];

        const stringProperties = [
          "id",
          "name",
          "label",
          "placeholder",
          "defaultValue",
          "helpText",
          "pattern",
          "errorMessage",
        ];

        const numericProperties = [
          "minLength",
          "maxLength",
          "minValue",
          "maxValue",
        ];

        const validFields = schema.fields.every((field) => {
          if (
            !field ||
            typeof field !== "object" ||
            Array.isArray(field) ||
            !validTypes.includes(field.type)
          ) {
            return false;
          }

          if (
            !stringProperties.every((key) => typeof field[key] === "string")
          ) {
            return false;
          }

          if (typeof field.required !== "boolean") {
            return false;
          }

          if (
            !numericProperties.every(
              (key) =>
                field[key] === "" ||
                (typeof field[key] === "number" &&
                  Number.isFinite(field[key])) ||
                (typeof field[key] === "string" &&
                  field[key].trim() !== "" &&
                  Number.isFinite(Number(field[key]))),
            )
          ) {
            return false;
          }

          if (
            !Array.isArray(field.options) ||
            !field.options.every((option) => typeof option === "string")
          ) {
            return false;
          }

          if (
            !Array.isArray(field.conditions) ||
            !field.conditions.every(
              (condition) =>
                condition &&
                typeof condition === "object" &&
                !Array.isArray(condition) &&
                validOperators.includes(condition.operator),
            )
          ) {
            return false;
          }

          return true;
        });

        if (!validFields) {
          throw new Error("Schema contains invalid fields.");
        }

        const fieldIds = schema.fields.map((field) => field.id);
        const fieldNames = schema.fields.map((field) => field.name);

        const validFieldIds = new Set(fieldIds);

        const hasInvalidConditions = schema.fields.some((field) =>
          field.conditions.some(
            (condition) => !validFieldIds.has(condition.fieldId),
          ),
        );

        if (hasInvalidConditions) {
          throw new Error("Condition references an invalid field.");
        }

        //circular condition
        const fieldMap = new Map(
          schema.fields.map((field) => [field.id, field]),
        );

        function hasCircularCondition(fieldId, visited = new Set()) {
          if (visited.has(fieldId)) {
            return true;
          }

          const field = fieldMap.get(fieldId);

          if (!field) return false;

          const nextVisited = new Set(visited);
          nextVisited.add(fieldId);

          return field.conditions.some((condition) =>
            hasCircularCondition(condition.fieldId, nextVisited),
          );
        }

        const hasCircularConditions = schema.fields.some((field) =>
          hasCircularCondition(field.id),
        );

        if (hasCircularConditions) {
          throw new Error("Circular conditions are not allowed.");
        }

        if (
          new Set(fieldIds).size !== fieldIds.length ||
          new Set(fieldNames).size !== fieldNames.length
        ) {
          throw new Error("Duplicate field IDs or names found.");
        }

        setFormTitle(
          typeof schema.title === "string" ? schema.title : "Untitled Form",
        );
        setFields(schema.fields);
        setSelectedFieldId(null);
        setFormValues({});
        setErrors({});
        setSubmittedData(null);
      } catch (error) {
        setImportError(
          error.message || "Invalid JSON file or unsupported schema.",
        );
      }
    };

    reader.readAsText(file);
    e.target.value = "";
  }

  function handleDrop(targetFieldId) {
    if (!draggedFieldId || draggedFieldId === targetFieldId) {
      setDraggedFieldId(null);
      return;
    }

    setFields((currentFields) => {
      const updatedFields = [...currentFields];

      const draggedIndex = updatedFields.findIndex(
        (field) => field.id === draggedFieldId,
      );

      const targetIndex = updatedFields.findIndex(
        (field) => field.id === targetFieldId,
      );

      if (draggedIndex === -1 || targetIndex === -1) {
        return currentFields;
      }

      const [draggedField] = updatedFields.splice(draggedIndex, 1);
      updatedFields.splice(targetIndex, 0, draggedField);

      return updatedFields;
    });

    setDraggedFieldId(null);
  }

  //keyboard reorder
  function moveField(fieldId, direction) {
    setFields((currentFields) => {
      const updatedFields = [...currentFields];

      const currentIndex = updatedFields.findIndex(
        (field) => field.id === fieldId,
      );

      const newIndex = currentIndex + direction;

      if (newIndex < 0 || newIndex >= updatedFields.length) {
        return currentFields;
      }

      [updatedFields[currentIndex], updatedFields[newIndex]] = [
        updatedFields[newIndex],
        updatedFields[currentIndex],
      ];

      return updatedFields;
    });
  }

  // const visibleFields = getVisibleFields(fields, formValues);
  const previewInitialValues = Object.fromEntries(
    fields.map((field) => [
      field.name,
      formValues[field.name] ??
      field.defaultValue ??
      (field.type === "Checkbox" ? false : ""),
    ]),
  );

  function validatePreviewForm(values) {
    const errors = {};

    const currentVisibleFields = getVisibleFields(fields, values);

    currentVisibleFields.forEach((field) => {
      const value =
        values[field.name] ??
        field.defaultValue ??
        (field.type === "Checkbox" ? false : "");

      const fieldErrors = validateField(field, value);

      if (fieldErrors.length > 0) {
        errors[field.name] = fieldErrors;
      }
    });

    return errors;
  }

  function handleFormikSubmit(values) {
    const currentVisibleFields = getVisibleFields(fields, values);

    const submittedValues = Object.fromEntries(
      currentVisibleFields.map((field) => [
        field.name,
        values[field.name] ??
        field.defaultValue ??
        (field.type === "Checkbox" ? false : ""),
      ]),
    );

    setSubmittedData(submittedValues);
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <div className="min-h-screen bg-slate-100 text-slate-900">
              <header className="border-b bg-white px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h1 className="text-xl font-bold text-indigo-600 lg:text-2xl">
                    FormCraft
                    {user && (
                      <div className="flex text-gray-700 items-center gap-3">
                        <span className="text-sm">Username: {user.name}</span>
                      </div>
                    )}
                  </h1>

                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-40 sm:w-56"
                    placeholder="Enter form title"
                  />

                  {/* Mobile Menu Icon */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsMenuOpen((prev) => !prev)}
                    className="text-xl md:hidden"
                    aria-label="Toggle menu"
                    aria-expanded={isMenuOpen}
                  >
                    {isMenuOpen ? "✕" : "☰"}
                  </Button>

                  {/* Desktop Buttons */}
                  <div className="hidden items-center gap-3 md:flex">
                    <Button
                      onClick={handleSaveForm}
                      disabled={isSaving}
                      className="bg-green-700 text-white hover:bg-green-800"
                    >
                      {isSaving ? "Saving..." : "Save Form"}
                    </Button>

                    <Button
                      onClick={() => {
                        handlePublishForm();
                        setIsMenuOpen(false);
                      }}
                      disabled={
                        !formId || isPublishing || formStatus === "published"
                      }
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {isPublishing
                        ? "Publishing..."
                        : formStatus === "published"
                          ? "Published"
                          : "Publish"}
                    </Button>

                    <Button variant="secondary" onClick={handleNewForm}>
                      + New Form
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsPreview((current) => !current);
                        setSubmittedData(null);
                      }}
                    >
                      {isPreview ? "Back to Builder" : "Preview"}
                    </Button>

                    <Button
                      onClick={exportJSON}
                      className="bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      Export JSON
                    </Button>

                    <Label
                      htmlFor="import-json"
                      className={buttonVariants({
                        variant: "outline",
                        size: "lg",
                        className: "cursor-pointer relative",
                      })}
                    >
                      Import JSON
                      <Input
                        id="import-json"
                        type="file"
                        accept=".json,application/json"
                        onChange={importJSON}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </Label>

                    <Button
                      variant="outline"
                      onClick={async () => {
                        await logout();
                        navigate("/login", { replace: true });
                      }}
                    >
                      Logout
                    </Button>
                  </div>
                </div>

                {/* Mobile Dropdown Menu */}
                {isMenuOpen && (
                  <div className="mt-4 flex flex-col gap-2 md:hidden">
                    <Button
                      onClick={() => {
                        handleSaveForm();
                        setIsMenuOpen(false);
                      }}
                      disabled={isSaving}
                      className="w-full bg-green-700 text-white hover:bg-green-800"
                    >
                      {isSaving ? "Saving..." : "Save Form"}
                    </Button>

                    <Button
                      onClick={() => {
                        handlePublishForm();
                        setIsMenuOpen(false);
                      }}
                      disabled={
                        !formId || isPublishing || formStatus === "published"
                      }
                      className="w-full bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {isPublishing
                        ? "Publishing..."
                        : formStatus === "published"
                          ? "Published"
                          : "Publish"}
                    </Button>

                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        handleNewForm();
                        setIsMenuOpen(false);
                      }}
                    >
                      + New Form
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setIsPreview((current) => !current);
                        setSubmittedData(null);
                        setIsMenuOpen(false);
                      }}
                    >
                      {isPreview ? "Back to Builder" : "Preview"}
                    </Button>

                    <Button
                      className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
                      onClick={() => {
                        exportJSON();
                        setIsMenuOpen(false);
                      }}
                    >
                      Export JSON
                    </Button>

                    <Label
                      className={buttonVariants({
                        variant: "outline",
                        size: "lg",
                        className: "w-full cursor-pointer",
                      })}
                    >
                      Import JSON
                      <Input
                        type="file"
                        accept=".json,application/json"
                        onChange={(e) => {
                          importJSON(e);
                          setIsMenuOpen(false);
                        }}
                        className="sr-only"
                      />
                    </Label>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={async () => {
                        setIsMenuOpen(false);
                        await logout();
                        navigate("/login", { replace: true });
                      }}
                    >
                      Logout
                    </Button>
                  </div>
                )}

                {saveMessage && (
                  <p
                    className={`mt-2 text-sm ${saveMessageType === "error"
                      ? "text-red-500"
                      : "text-green-700"
                      }`}
                  >
                    {saveMessage}
                  </p>
                )}

                {importError && (
                  <p role="alert" className="mt-2 text-sm text-red-600">
                    {importError}
                  </p>
                )}
              </header>

              <main className="grid min-h-[calc(100vh-73px)] grid-cols-1 sm:p-4 lg:grid-cols-12 gap-4 p-4">
                <aside
                  aria-label="Field Palette"
                  className="rounded-xl border bg-white p-3 sm:p-4 lg:col-span-3"
                >
                  {" "}
                  <h2 className="mb-4 text-lg font-semibold">Field Palette</h2>
                  <div className="space-y-3">
                    {fieldTypes.map((type) => (
                      <Button
                        key={type}
                        type="button"
                        variant="outline"
                        draggable
                        onClick={() => addField(type)}
                        onDragStart={() => setDraggedFieldType(type)}
                        onDragEnd={() => setDraggedFieldType(null)}
                        className="w-full justify-start p-3 hover:border-indigo-500 hover:bg-indigo-50"
                      >
                        + {type}
                      </Button>
                    ))}
                  </div>
                </aside>

                <section className="min-w-0 rounded-xl border bg-white p-3 sm:p-4 lg:col-span-6">
                  <h2 className="mb-4 text-lg font-semibold">
                    {isPreview ? "Form Preview" : "Form Canvas"}
                  </h2>

                  {isPreview ? (
                    <Formik
                      initialValues={previewInitialValues}
                      validate={validatePreviewForm}
                      onSubmit={handleFormikSubmit}
                    >
                      <Form noValidate className="space-y-4">
                        <FormRenderer
                          schema={{ title: formTitle, fields }}
                          onValueChange={updateFormValue}
                        />

                        <Button
                          type="submit"
                          className="bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          Submit
                        </Button>

                        {submittedData && (
                          <pre
                            tabIndex={0}
                            className="overflow-auto rounded-lg bg-slate-100 p-3 text-sm focus:outline-2 focus:outline-indigo-600"
                          >
                            {JSON.stringify(submittedData, null, 2)}
                          </pre>
                        )}
                      </Form>
                    </Formik>
                  ) : (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();

                        if (draggedFieldType) {
                          addField(draggedFieldType);
                          setDraggedFieldType(null);
                        }
                      }}
                      className="min-h-[500px] space-y-4 rounded-lg border-2 border-dashed border-slate-300 p-4"
                    >
                      {fields.length === 0 ? (
                        <p className="py-20 text-center text-slate-500">
                          Add fields here to build your form.
                        </p>
                      ) : (
                        fields.map((field) => (
                          <div
                            key={field.id}
                            tabIndex={0}

                            onKeyDown={(e) => {
                              if (e.target !== e.currentTarget) return;

                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedFieldId(field.id);
                              }

                              if (e.key === "ArrowUp") {
                                e.preventDefault();
                                moveField(field.id, -1);
                              }

                              if (e.key === "ArrowDown") {
                                e.preventDefault();
                                moveField(field.id, 1);
                              }
                            }}
                            draggable
                            onDragStart={() => setDraggedFieldId(field.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop(field.id)}
                            onDragEnd={() => setDraggedFieldId(null)}
                            onClick={() => setSelectedFieldId(field.id)}

                            className={`cursor-move rounded-lg border bg-white p-4 ${selectedFieldId === field.id
                              ? "border-indigo-600 ring-2 ring-indigo-100"
                              : "border-slate-200"
                              } ${draggedFieldId === field.id ? "opacity-50" : ""}`}
                          >
                            {renderField(field)}
                            {field.helpText && (
                              <p className="mt-1 text-sm text-slate-500">
                                {field.helpText}
                              </p>
                            )}

                            <p className="mt-1 text-sm text-slate-500">
                              Type: {field.type} · Name: {field.name}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </section>

                <aside className="min-w-0 rounded-xl border bg-white p-3 sm:p-4 lg:col-span-3">
                  <div className="mb-5 border-b pb-4">
                    <h2 className="mb-3 text-lg font-semibold">Saved Forms</h2>

                    <Button
                      type="button"
                      onClick={fetchSavedForms}
                      className="mb-3 bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      Refresh Forms
                    </Button>

                    <div className="space-y-2">
                      {savedForms.map((form) => (
                        <div
                          key={form._id}
                          className="flex flex-col items-center justify-between gap-2 rounded-lg border p-2"
                        >
                          <span className="text-sm font-bold">
                            {form.title}
                          </span>
                          <span
                            className={`text-xs font-medium ${form.status === "published"
                              ? "text-green-700"
                              : "text-amber-800"
                              }`}
                          >
                            {form.status || "draft"}
                          </span>

                          <div className="flex flex-wrap justify-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleLoadForm(form._id)}
                            >
                              Load
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                window.open(`/forms/${form._id}`, "_blank")
                              }
                            >
                              Open Form
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopyLink(form._id)}
                            >
                              Copy Link
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteForm(form._id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <h2 className="mb-4 text-lg font-semibold">Properties</h2>

                  {!selectedField ? (
                    <p className="text-sm text-slate-500">
                      Select a field to configure its properties.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label
                          htmlFor={`${selectedField.id}-property-label`}
                          className="mb-1 block text-sm font-medium"
                        >
                          Label
                        </Label>
                        <Input
                          id={`${selectedField.id}-property-label`}
                          value={selectedField.label}
                          onChange={(e) =>
                            updateSelectedField("label", e.target.value)
                          }
                          className="w-full rounded-lg border p-2"
                        />
                      </div>

                      <div>
                        <Label
                          htmlFor={`${selectedField.id}-property-name`}
                          className="mb-1 block text-sm font-medium"
                        >
                          Name
                        </Label>
                        <Input
                          id={`${selectedField.id}-property-name`}
                          value={selectedField.name}
                          onChange={(e) =>
                            updateSelectedField("name", e.target.value)
                          }
                          className="w-full rounded-lg border p-2"
                        />
                      </div>

                      <div>
                        <Label
                          htmlFor={`${selectedField.id}-property-placeholder`}
                          className="mb-1 block text-sm font-medium"
                        >
                          Placeholder
                        </Label>
                        <Input
                          id={`${selectedField.id}-property-placeholder`}
                          value={selectedField.placeholder}
                          onChange={(e) =>
                            updateSelectedField("placeholder", e.target.value)
                          }
                          className="w-full rounded-lg border p-2"
                        />
                      </div>

                      <div>
                        <Label
                          htmlFor={`${selectedField.id}-property-default`}
                          className="mb-1 block text-sm font-medium"
                        >
                          Default Value
                        </Label>
                        <Input
                          id={`${selectedField.id}-property-default`}
                          value={selectedField.defaultValue ?? ""}
                          onChange={(e) =>
                            updateSelectedField("defaultValue", e.target.value)
                          }
                          className="w-full rounded-lg border p-2"
                        />
                      </div>

                      <div>
                        <Label
                          htmlFor={`${selectedField.id}-property-help`}
                          className="mb-1 block text-sm font-medium"
                        >
                          Help Text
                        </Label>
                        <Input
                          id={`${selectedField.id}-property-help`}
                          value={selectedField.helpText ?? ""}
                          onChange={(e) =>
                            updateSelectedField("helpText", e.target.value)
                          }
                          className="w-full rounded-lg border p-2"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`${selectedField.id}-property-required`}
                          className="flex items-center gap-2"
                        >
                          <Checkbox
                            id={`${selectedField.id}-property-required`}
                            checked={selectedField.required}
                            onCheckedChange={(checked) =>
                              updateSelectedField("required", checked === true)
                            }
                          />
                          Required field
                        </Label>
                      </div>

                      <div className="space-y-3 rounded-lg border p-3">
                        <h3 className="font-medium">Conditional Logic</h3>

                        <Label
                          htmlFor={`${selectedField.id}-condition-field`}
                          className="block text-sm"
                        >
                          Show this field when
                        </Label>

                        {/* Source field: native select retained to preserve empty-string behaviour */}
                        <select
                          id={`${selectedField.id}-condition-field`}
                          className="w-full rounded-lg border p-2"
                          value={selectedField.conditions?.[0]?.fieldId || ""}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const currentConditions =
                              selectedField.conditions || [];

                            if (!selectedId) {
                              updateSelectedField(
                                "conditions",
                                currentConditions.slice(1),
                              );
                              return;
                            }

                            const updatedConditions = [...currentConditions];

                            if (updatedConditions.length > 0) {
                              updatedConditions[0] = {
                                ...updatedConditions[0],
                                fieldId: selectedId,
                              };
                            } else {
                              updatedConditions.push({
                                fieldId: selectedId,
                                operator: "equals",
                                value: "",
                              });
                            }

                            updateSelectedField(
                              "conditions",
                              updatedConditions,
                            );
                          }}
                        >
                          <option value="">Always show</option>

                          {fields
                            .filter((field) => field.id !== selectedField.id)
                            .map((field) => (
                              <option key={field.id} value={field.id}>
                                {field.label}
                              </option>
                            ))}
                        </select>

                        {selectedField.conditions?.length > 0 && (
                          <div className="space-y-3">
                            <Label
                              htmlFor={`${selectedField.id}-condition-match`}
                              className="font-medium"
                            >
                              Match Conditions
                            </Label>

                            {/* AND / OR selection */}
                            <Select
                              value={selectedField.conditionLogic || "AND"}
                              onValueChange={(value) =>
                                updateSelectedField("conditionLogic", value)
                              }
                            >
                              <SelectTrigger
                                id={`${selectedField.id}-condition-match`}
                                className="w-full"
                              >
                                <SelectValue />
                              </SelectTrigger>

                              <SelectContent>
                                <SelectItem value="AND">
                                  Match ALL conditions (AND)
                                </SelectItem>

                                <SelectItem value="OR">
                                  Match ANY condition (OR)
                                </SelectItem>
                              </SelectContent>
                            </Select>

                            {/* Multiple conditions */}
                            {selectedField.conditions.map(
                              (condition, index) => (
                                <div
                                  key={index}
                                  className="space-y-2 rounded-lg border p-3"
                                >
                                  <Label
                                    htmlFor={`${selectedField.id}-condition-${index}`}
                                    className="text-sm font-medium"
                                  >
                                    Condition {index + 1}
                                  </Label>

                                  {/* Source field: native select retained to preserve empty-string behaviour */}
                                  <select
                                    id={`${selectedField.id}-condition-${index}`}
                                    className="w-full rounded-lg border p-2"
                                    value={condition.fieldId}
                                    onChange={(e) => {
                                      const updated = [
                                        ...selectedField.conditions,
                                      ];

                                      updated[index] = {
                                        ...condition,
                                        fieldId: e.target.value,
                                      };

                                      updateSelectedField(
                                        "conditions",
                                        updated,
                                      );
                                    }}
                                  >
                                    <option value="">Select field</option>

                                    {fields
                                      .filter(
                                        (field) =>
                                          field.id !== selectedField.id,
                                      )
                                      .map((field) => (
                                        <option key={field.id} value={field.id}>
                                          {field.label}
                                        </option>
                                      ))}
                                  </select>

                                  {/* Operator */}
                                  <Select
                                    value={condition.operator}
                                    onValueChange={(value) => {
                                      const updated = [
                                        ...selectedField.conditions,
                                      ];

                                      updated[index] = {
                                        ...condition,
                                        operator: value,
                                      };

                                      updateSelectedField(
                                        "conditions",
                                        updated,
                                      );
                                    }}
                                  >
                                    <SelectTrigger
                                      id={`${selectedField.id}-condition-operator-${index}`}
                                      aria-label={`Condition ${index + 1} operator`}
                                      className="w-full"
                                    >
                                      <SelectValue />
                                    </SelectTrigger>

                                    <SelectContent>
                                      <SelectItem value="equals">
                                        Equals
                                      </SelectItem>
                                      <SelectItem value="notEquals">
                                        Does not equal
                                      </SelectItem>
                                      <SelectItem value="contains">
                                        Contains
                                      </SelectItem>
                                      <SelectItem value="greaterThan">
                                        Greater than
                                      </SelectItem>
                                      <SelectItem value="lessThan">
                                        Less than
                                      </SelectItem>
                                      <SelectItem value="isEmpty">
                                        Is empty
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>

                                  {/* Comparison value */}
                                  {condition.operator !== "isEmpty" && (
                                    <Input
                                      id={`${selectedField.id}-condition-value-${index}`}
                                      aria-label={`Condition ${index + 1} comparison value`}
                                      placeholder="Comparison value"
                                      value={condition.value ?? ""}
                                      onChange={(e) => {
                                        const updated = [
                                          ...selectedField.conditions,
                                        ];

                                        updated[index] = {
                                          ...condition,
                                          value: e.target.value,
                                        };

                                        updateSelectedField(
                                          "conditions",
                                          updated,
                                        );
                                      }}
                                    />
                                  )}

                                  {/* Remove condition */}
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() =>
                                      updateSelectedField(
                                        "conditions",
                                        selectedField.conditions.filter(
                                          (_, i) => i !== index,
                                        ),
                                      )
                                    }
                                  >
                                    Remove Condition
                                  </Button>
                                </div>
                              ),
                            )}

                            {/* Add condition */}
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() =>
                                updateSelectedField("conditions", [
                                  ...selectedField.conditions,
                                  {
                                    fieldId: "",
                                    operator: "equals",
                                    value: "",
                                  },
                                ])
                              }
                            >
                              + Add Condition
                            </Button>
                          </div>
                        )}
                      </div>

                      {["Text", "Textarea", "Email"].includes(
                        selectedField.type,
                      ) && (
                          <>
                            <div>
                              <Label
                                htmlFor={`${selectedField.id}-property-min-length`}
                                className="mb-1 block text-sm font-medium"
                              >
                                Minimum Length
                              </Label>
                              <Input
                                id={`${selectedField.id}-property-min-length`}
                                type="number"
                                min="0"
                                value={selectedField.minLength ?? ""}
                                onChange={(e) =>
                                  updateSelectedField("minLength", e.target.value)
                                }
                                className="w-full rounded-lg border p-2"
                              />
                            </div>

                            <div>
                              <Label
                                htmlFor={`${selectedField.id}-property-max-length`}
                                className="mb-1 block text-sm font-medium"
                              >
                                Maximum Length
                              </Label>
                              <Input
                                id={`${selectedField.id}-property-max-length`}
                                type="number"
                                min="0"
                                value={selectedField.maxLength ?? ""}
                                onChange={(e) =>
                                  updateSelectedField("maxLength", e.target.value)
                                }
                                className="w-full rounded-lg border p-2"
                              />
                            </div>
                            <div>
                              <Label
                                htmlFor={`${selectedField.id}-property-pattern`}
                                className="mb-1 block text-sm font-medium"
                              >
                                Regex Pattern
                              </Label>
                              <Input
                                id={`${selectedField.id}-property-pattern`}
                                value={selectedField.pattern ?? ""}
                                onChange={(e) =>
                                  updateSelectedField("pattern", e.target.value)
                                }
                                placeholder="Example: ^[A-Za-z]+$"
                                className="w-full rounded-lg border p-2"
                              />
                              {selectedField.pattern &&
                                validatePattern(selectedField.pattern) && (
                                  <p
                                    className="mt-1 text-sm text-red-600"
                                    role="alert"
                                  >
                                    {validatePattern(selectedField.pattern)}
                                  </p>
                                )}
                            </div>
                          </>
                        )}

                      {selectedField.type === "Number" && (
                        <>
                          <div>
                            <Label
                              htmlFor={`${selectedField.id}-property-min-value`}
                              className="mb-1 block text-sm font-medium"
                            >
                              Minimum Value
                            </Label>
                            <Input
                              id={`${selectedField.id}-property-min-value`}
                              type="number"
                              value={selectedField.minValue ?? ""}
                              onChange={(e) =>
                                updateSelectedField("minValue", e.target.value)
                              }
                              className="w-full rounded-lg border p-2"
                            />
                          </div>

                          <div>
                            <Label
                              htmlFor={`${selectedField.id}-property-max-value`}
                              className="mb-1 block text-sm font-medium"
                            >
                              Maximum Value
                            </Label>
                            <Input
                              id={`${selectedField.id}-property-max-value`}
                              type="number"
                              value={selectedField.maxValue ?? ""}
                              onChange={(e) =>
                                updateSelectedField("maxValue", e.target.value)
                              }
                              className="w-full rounded-lg border p-2"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <Label
                          htmlFor={`${selectedField.id}-property-custom-error`}
                          className="mb-1 block text-sm font-medium"
                        >
                          Custom Error Message
                        </Label>
                        <Input
                          id={`${selectedField.id}-property-custom-error`}
                          value={selectedField.errorMessage ?? ""}
                          onChange={(e) =>
                            updateSelectedField("errorMessage", e.target.value)
                          }
                          placeholder="Please enter a valid value"
                          className="w-full rounded-lg border p-2"
                        />
                      </div>

                      {(selectedField.type === "Select" ||
                        selectedField.type === "Radio Group") && (
                          <div>
                            <Label
                              htmlFor={`${selectedField.id}-radio-options`}
                              className="mb-1 block text-sm font-medium"
                            >
                              Options
                            </Label>

                            <Textarea
                              id={`${selectedField.id}-radio-options`}
                              value={(selectedField.options || []).join("\n")}
                              onChange={(e) =>
                                updateSelectedField(
                                  "options",
                                  e.target.value.split("\n"),
                                )
                              }
                              rows={4}
                              className="w-full rounded-lg border p-2"
                              placeholder={"India\nUSA\nCanada"}
                            />
                          </div>
                        )}

                      <Button
                        type="button"
                        variant="destructive"
                        className="w-full"
                        onClick={deleteSelectedField}
                      >
                        Delete Field
                      </Button>
                    </div>
                  )}
                </aside>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
      <Route path="/forms/:id" element={<PublishedFormPage />} />
      <Route path="/login" element={<Auth />} />
      <Route path="/signup" element={<Auth />} />
    </Routes>
  );
}

export default App;
