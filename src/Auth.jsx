import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Formik, Form } from "formik";
import { GoogleLogin } from "@react-oauth/google";

import { apiRequest } from "./services/api";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { useAuth } from "./context/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";

function Auth() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isSignup = location.pathname === "/signup";

  const [serverError, setServerError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const initialValues = {
    name: "",
    email: "",
    password: "",
  };

  function validate(values) {
    const errors = {};

    if (isSignup && !values.name.trim()) {
      errors.name = "Name is required";
    }

    if (!values.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      errors.email = "Enter a valid email address";
    }

    if (!values.password) {
      errors.password = "Password is required";
    } else if (isSignup) {
      if (
        values.password.length < 8 ||
        !/[a-z]/.test(values.password) ||
        !/[A-Z]/.test(values.password) ||
        !/[0-9]/.test(values.password) ||
        !/[^A-Za-z0-9]/.test(values.password)
      ) {
        errors.password =
          "Use 8+ characters with uppercase, lowercase, number and special character";
      }
    }

    return errors;
  }

  async function handleSubmit(values, { setSubmitting }) {
    setServerError("");
    setNotice("");

    try {
      if (isSignup) {
        const response = await apiRequest("/auth/send-otp", {
          method: "POST",
          body: JSON.stringify(values),
        });

        setPendingEmail(values.email.trim().toLowerCase());
        setOtpStep(true);
        setNotice(response.message);
      } else {
        await apiRequest("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: values.email,
            password: values.password,
          }),
        });

        await refreshUser();
        navigate(location.state?.from || "/");
      }
    } catch (error) {
      setServerError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOTP(event) {
    event.preventDefault();
    setServerError("");
    setNotice("");

    if (!/^\d{6}$/.test(otp)) {
      setServerError("Please enter a valid 6-digit OTP.");
      return;
    }

    setOtpLoading(true);

    try {
      await apiRequest("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          email: pendingEmail,
          otp,
        }),
      });

      await refreshUser();
      navigate(location.state?.from || "/");
    } catch (error) {
      setServerError(error.message);
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResendOTP() {
    setServerError("");
    setNotice("");
    setResendLoading(true);

    try {
      const response = await apiRequest("/auth/resend-otp", {
        method: "POST",
        body: JSON.stringify({
          email: pendingEmail,
        }),
      });

      setOtp("");
      setNotice(response.message);
    } catch (error) {
      setServerError(error.message);
    } finally {
      setResendLoading(false);
    }
  }

  async function handleGoogleSuccess(response) {
    setServerError("");
    setGoogleLoading(true);

    try {
      await apiRequest("/auth/google", {
        method: "POST",
        body: JSON.stringify({
          credential: response.credential,
        }),
      });

      await refreshUser();
      navigate(location.state?.from || "/");
    } catch (error) {
      setServerError(error.message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {otpStep
              ? "Verify your email"
              : isSignup
                ? "Create your account"
                : "Welcome back"}
          </CardTitle>

          <CardDescription>
            {otpStep
              ? `Enter the 6-digit code sent to ${pendingEmail}.`
              : isSignup
                ? "Sign up to start creating forms with FormCraft."
                : "Log in to continue to FormCraft."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {notice && (
            <p className="mb-4 text-center text-sm text-green-600">{notice}</p>
          )}

          {serverError && (
            <p className="mb-4 text-center text-sm text-destructive">
              {serverError}
            </p>
          )}

          {otpStep ? (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>

                <Input
                  id="otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={otpLoading || otp.length !== 6}
              >
                {otpLoading ? "Verifying..." : "Verify Email"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResendOTP}
                disabled={resendLoading}
              >
                {resendLoading ? "Sending..." : "Resend OTP"}
              </Button>

              <button
                type="button"
                className="w-full text-center text-sm text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setOtpStep(false);
                  setOtp("");
                  setServerError("");
                  setNotice("");
                }}
              >
                Back to signup
              </button>
            </form>
          ) : (
            <>
              <Formik
                initialValues={initialValues}
                validate={validate}
                onSubmit={handleSubmit}
              >
                {({
                  values,
                  errors,
                  touched,
                  handleChange,
                  handleBlur,
                  isSubmitting,
                }) => (
                  <Form className="space-y-4">
                    {isSignup && (
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          name="name"
                          placeholder="Enter your name"
                          value={values.name}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          aria-invalid={Boolean(touched.name && errors.name)}
                        />
                        {touched.name && errors.name && (
                          <p className="text-sm text-destructive">
                            {errors.name}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="Enter your email"
                        value={values.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        aria-invalid={Boolean(touched.email && errors.email)}
                      />
                      {touched.email && errors.email && (
                        <p className="text-sm text-destructive">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="Enter your password"
                        value={values.password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        aria-invalid={Boolean(
                          touched.password && errors.password,
                        )}
                      />
                      {touched.password && errors.password && (
                        <p className="text-sm text-destructive">
                          {errors.password}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? "Please wait..."
                        : isSignup
                          ? "Send Verification Code"
                          : "Log In"}
                    </Button>
                  </Form>
                )}
              </Formik>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">OR</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() =>
                    setServerError("Google login failed. Please try again.")
                  }
                  useOneTap={false}
                />
              </div>

              {googleLoading && (
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  Signing in with Google...
                </p>
              )}
            </>
          )}

          {!otpStep && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setServerError("");
                  setNotice("");
                  navigate(isSignup ? "/login" : "/signup");
                }}
              >
                {isSignup ? "Log in" : "Sign up"}
              </button>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Auth;
