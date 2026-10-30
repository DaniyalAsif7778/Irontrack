import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dumbbell, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { loginSchema, registerSchema, type AuthValues } from "../../schemas/auth";
import { api } from "../../lib/api/api";
import type { AuthUser } from "../../types";

const sessionKey = ["auth", "me"] as const;
type AuthMode = "login" | "register" | "forgot" | "reset" | "verify" | "sent" | "verified";

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>(() => location.pathname === "/signup" ? "register" : location.pathname === "/reset-password" ? "reset" : location.pathname === "/verify-email" ? "verify" : "login");
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const linkHandled = useRef(false);
  const queryClient = useQueryClient();
  const schema = mode === "register" ? registerSchema : loginSchema;
  const { register, handleSubmit, reset, getValues, formState: { errors, isSubmitting } } = useForm<AuthValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "" },
  });

  useEffect(() => {
    const isVerify = location.pathname === "/verify-email";
    const isReset = location.pathname === "/reset-password";
    if (!isVerify && !isReset) { linkHandled.current = false; return; }
    if (linkHandled.current) return;
    linkHandled.current = true;
    const token = new URLSearchParams(location.hash.slice(1)).get("token") ?? "";
    navigate(location.pathname, { replace: true });
    if (isReset) {
      setResetToken(token);
      setMode("reset");
      if (!token) setServerError("This password reset link is invalid or expired.");
      return;
    }
    setMode("verify");
    if (!token) { setServerError("This verification link is invalid or expired."); return; }
    setIsWorking(true);
    api<{ message: string }>("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) })
      .then(result => { setNotice(result.message); setMode("verified"); })
      .catch(error => setServerError(error instanceof Error ? error.message : "This verification link is invalid or expired."))
      .finally(() => setIsWorking(false));
  }, [location.pathname, location.hash, navigate]);

  async function submit(values: AuthValues) {
    setServerError("");
    setNotice("");
    try {
      if (mode === "register") {
        const result = await api<{ message: string }>("/auth/register", { method: "POST", body: JSON.stringify({ name: values.name, email: values.email, password: values.password }) });
        setNotice(result.message);
        setMode("sent");
        return;
      }
      if (mode === "forgot") {
        const result = await api<{ message: string }>("/auth/password/forgot", { method: "POST", body: JSON.stringify({ email: values.email }) });
        setNotice(result.message);
        setMode("sent");
        return;
      }
      const payload = await api<{ user: AuthUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email: values.email, password: values.password }) });
      queryClient.setQueryData(sessionKey, payload.user);
      navigate("/", { replace: true });
    } catch (reason) {
      setServerError(reason instanceof Error ? reason.message : "We could not complete that request. Try again.");
    }
  }

  function changeMode(next: AuthMode) {
    setMode(next);
    setServerError("");
    setNotice("");
    reset();
    if (next === "register") navigate("/signup", { replace: true });
    else navigate("/login", { replace: true });
  }

  async function resendVerification() {
    const email = getValues("email");
    setServerError("");
    setNotice("");
    if (!email.trim()) { setServerError("Enter your email address first."); return; }
    setIsWorking(true);
    try {
      const result = await api<{ message: string }>("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) });
      setNotice(result.message);
    } catch (reason) {
      setServerError(reason instanceof Error ? reason.message : "Try again in a few minutes.");
    } finally { setIsWorking(false); }
  }

  async function saveNewPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError("");
    if (newPassword.length < 12 || newPassword.length > 128) { setServerError("Use a password between 12 and 128 characters."); return; }
    if (newPassword !== confirmPassword) { setServerError("The passwords do not match."); return; }
    setIsWorking(true);
    try {
      const result = await api<{ message: string }>("/auth/password/reset", { method: "POST", body: JSON.stringify({ token: resetToken, password: newPassword }) });
      setNotice(result.message);
      setMode("verified");
    } catch (reason) {
      setServerError(reason instanceof Error ? reason.message : "This reset link is invalid or expired.");
    } finally { setIsWorking(false); }
  }

  const isForm = mode === "login" || mode === "register" || mode === "forgot";
  const heading = mode === "register" ? "Create your account" : mode === "forgot" ? "Reset your password" : mode === "reset" ? "Choose a new password" : mode === "verify" ? "Confirming your email" : mode === "verified" ? "You’re all set" : mode === "sent" ? "Check your inbox" : "Welcome back";

  return <main className="auth-screen">
    <section className="auth-card" aria-labelledby="auth-heading">
      <div className="auth-brand"><span><Dumbbell size={20} /></span><b>IronTrack</b></div>
      <h1 id="auth-heading">{heading}</h1>
      <p>{mode === "register" ? "Your training history stays with your account. Verify your email before signing in." : mode === "login" ? "Sign in to continue your training." : mode === "forgot" ? "We’ll email a secure link if an account matches." : mode === "reset" ? "Choose a new password for your account." : mode === "verify" ? "Your email link is being checked." : mode === "sent" ? "Use the link in the email to continue. It expires in 30 minutes." : mode === "verified" ? notice || "Return to sign in to continue." : ""}</p>

      {isForm && <>
        {mode !== "forgot" && <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "selected" : ""} onClick={() => changeMode("login")}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "selected" : ""} onClick={() => changeMode("register")}>Create account</button>
        </div>}
        <form className="auth-form" onSubmit={handleSubmit(submit)} noValidate>
          {mode === "register" && <label>Your name<input autoComplete="name" {...register("name")} placeholder="Name" />{errors.name && <small>{errors.name.message}</small>}</label>}
          <label>Email<input autoComplete="email" inputMode="email" type="email" {...register("email")} placeholder="you@example.com" />{errors.email && <small>{errors.email.message}</small>}</label>
          {mode !== "forgot" && <label>Password<span className="password-input"><input autoComplete={mode === "login" ? "current-password" : "new-password"} type={visiblePassword ? "text" : "password"} {...register("password")} placeholder="At least 12 characters" /><button type="button" aria-label={visiblePassword ? "Hide password" : "Show password"} onClick={() => setVisiblePassword(value => !value)}>{visiblePassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>{errors.password && <small>{errors.password.message}</small>}</label>}
          {serverError && <div className="auth-error" role="alert">{serverError}</div>}
          {notice && <div className="auth-notice" role="status">{notice}</div>}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "Working…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send reset link"}</button>
        </form>
        {mode === "login" && <div className="auth-links"><button type="button" onClick={() => changeMode("forgot")}>Forgot password?</button><button type="button" onClick={() => void resendVerification()} disabled={isWorking}>Resend verification email</button></div>}
        {mode === "forgot" && <button className="auth-text-button" type="button" onClick={() => changeMode("login")}>Back to sign in</button>}
        {mode === "register" && <small className="auth-note">Use 12 or more characters for your password.</small>}
      </>}

      {mode === "reset" && <form className="auth-form" onSubmit={saveNewPassword}>
        <label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={12} maxLength={128} required /></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={12} maxLength={128} required /></label>
        {serverError && <div className="auth-error" role="alert">{serverError}</div>}
        <button className="auth-submit" type="submit" disabled={isWorking || !resetToken}>{isWorking ? "Saving…" : "Update password"}</button>
        <button className="auth-text-button" type="button" onClick={() => changeMode("login")}>Back to sign in</button>
      </form>}
      {(mode === "verified" || mode === "sent") && <>
        {serverError && <div className="auth-error" role="alert">{serverError}</div>}
        <button className="auth-submit" type="button" onClick={() => changeMode("login")}>Return to sign in</button>
      </>}
      {mode === "verify" && <>
        {serverError && <div className="auth-error" role="alert">{serverError}</div>}
        {isWorking && <p role="status">Checking your link…</p>}
        {!isWorking && serverError && <button className="auth-submit" type="button" onClick={() => changeMode("login")}>Go to sign in</button>}
      </>}
    </section>
  </main>;
}
