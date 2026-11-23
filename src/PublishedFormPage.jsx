import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Formik, Form } from "formik";
import { apiRequest } from "./services/api";
import { validateField } from "../shared/validation";
import { getVisibleFields } from "../shared/conditionEvaluator";
import FormRenderer from "./FormRenderer";
import { Button } from "./components/ui/button";

function PublishedFormPage() {
  const { id } = useParams();

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function fetchForm(isInitial = false) {
      try {
        const data = await apiRequest(`/forms/${id}/published`);
        const fetchedForm = data.form || data;

        if (!isMounted) return;

        setForm((current) => {
          if (current?.updatedAt === fetchedForm.updatedAt) {
            return current;
          }

          return fetchedForm;
        });
      } catch (error) {
        if (isMounted && isInitial) {
          setError(error.message);
        }
      } finally {
        if (isMounted && isInitial) {
          setLoading(false);
        }
      }
    }

    fetchForm(true);

    const intervalId = setInterval(() => {
      fetchForm();
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [id]);

  useEffect(() => {
    if (!successMessage) return;

    const timer = setTimeout(() => {
      setSuccessMessage("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [successMessage]);

  function getInitialValues() {
    const initialValues = {};

    form.fields.forEach((field) => {
      initialValues[field.name] =
        field.defaultValue !== undefined
          ? field.defaultValue
          : field.type === "Checkbox"
            ? false
            : "";
    });

    return initialValues;
  }

  function validateForm(values) {
    const visibleFields = getVisibleFields(form.fields, values);
    const updatedErrors = {};

    visibleFields.forEach((field) => {
      const fieldErrors = validateField(field, values[field.name]);

      if (fieldErrors.length > 0) {
        updatedErrors[field.name] = fieldErrors;
      }
    });

    return updatedErrors;
  }

  async function handleSubmit(values, helpers) {
    setSuccessMessage("");

    try {
      const data = await apiRequest(`/forms/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          ...values,
          _formUpdatedAt: form.updatedAt,
        }),
      });

      setSuccessMessage(data.message || "Form submitted successfully!");

      helpers.resetForm({
        values: {},
      });
    } catch (error) {
      if (error.errors && Object.keys(error.errors).length > 0) {
        helpers.setErrors(error.errors);

        helpers.setTouched(
          Object.fromEntries(
            Object.keys(error.errors).map((fieldName) => [fieldName, true]),
          ),
        );

        setError("");
      } else {
        setError(error.message || "Unable to submit form. Please try again.");
      }
    }
  }

  if (loading) return <p>Loading form...</p>;

  if (error && !form) return <p>{error}</p>;

  if (!form) return <p>Form not found.</p>;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow">
        <h1 className="mb-6 text-2xl font-bold">{form.title}</h1>

        <Formik
          initialValues={getInitialValues()}
          validate={validateForm}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form noValidate>
              <FormRenderer schema={form} />

              <Button type="submit" disabled={isSubmitting} className="mt-4">
                {isSubmitting ? "Submitting..." : "Submit Form"}
              </Button>
            </Form>
          )}
        </Formik>

        {successMessage && (
          <p className="mt-4 text-green-700">{successMessage}</p>
        )}

        {error && form && <p className="mt-4 text-red-500">{error}</p>}
      </div>
    </div>
  );
}

export default PublishedFormPage;
