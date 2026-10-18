import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dumbbell, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { loginSchema, registerSchema, type AuthValues } from "../../schemas/auth";
import { api } from "../../lib/api/api";
import type { AuthUser } from "../../types";

const sessionKey = ["auth", "me"] as const;

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const queryClient = useQueryClient();
  const schema = mode === "register" ? registerSchema : loginSchema;
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<AuthValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function submit(values: AuthValues) {
    setServerError("");
    try {
      const payload = mode === "register"
        ? await api<{ user: AuthUser }>("/auth/register", { method: "POST", body: JSON.stringify({ name: values.name, email: values.email, password: values.password }) })
        : await api<{ user: AuthUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email: values.email, password: values.password }) });
      queryClient.setQueryData(sessionKey, payload.user);
    } catch (reason) {
      setServerError(reason instanceof Error ? reason.message : "We could not sign you in. Try again.");
    }
  }

  function changeMode(next: "login" | "register") {
    setMode(next);
    setServerError("");
    reset();
  }

  return <main className="auth-screen">
    <section className="auth-card" aria-labelledby="auth-heading">
      <div className="auth-brand"><span><Dumbbell size={20} /></span><b>IronTrack</b></div>
      <h1 id="auth-heading">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p>{mode === "login" ? "Sign in to continue your training." : "Your routines and training history stay with your account."}</p>
      <div className="auth-tabs" role="tablist" aria-label="Account access">
        <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "selected" : ""} onClick={() => changeMode("login")}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "selected" : ""} onClick={() => changeMode("register")}>Create account</button>
      </div>
      <form className="auth-form" onSubmit={handleSubmit(submit)} noValidate>
        {mode === "register" && <label>Your name<input autoComplete="name" {...register("name")} placeholder="Name" />{errors.name && <small>{errors.name.message}</small>}</label>}
        <label>Email<input autoComplete="email" inputMode="email" type="email" {...register("email")} placeholder="you@example.com" />{errors.email && <small>{errors.email.message}</small>}</label>
        <label>Password<span className="password-input"><input autoComplete={mode === "login" ? "current-password" : "new-password"} type={visiblePassword ? "text" : "password"} {...register("password")} placeholder="At least 12 characters" /><button type="button" aria-label={visiblePassword ? "Hide password" : "Show password"} onClick={() => setVisiblePassword(value => !value)}>{visiblePassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>{errors.password && <small>{errors.password.message}</small>}</label>
        {serverError && <div className="auth-error" role="alert">{serverError}</div>}
        <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "Working…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      {mode === "register" && <small className="auth-note">Use 12 or more characters for your password.</small>}
    </section>
  </main>;
}
