"use client";
/* eslint-disable jsx-a11y/no-autofocus -- initial authentication focus is intentional */

import { useEffect, useState } from "react";
import { ArrowRight, Check, KeyRound, LockKeyhole, Mail, Plane, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient, hasSupabaseConfiguration } from "../../lib/supabase/client";
import { ThemeToggle } from "../../components/ui/ThemeToggle";

export function LoginPage() {
  const configured = hasSupabaseConfiguration();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite") ?? "";
    queueMicrotask(() => { setInviteToken(token); if (token) setCreatingAccount(true); });
  }, []);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    if (window.location.hash.includes("type=recovery")) queueMicrotask(() => setRecoveryMode(true));
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const acceptInvite = async () => {
    if (!inviteToken) return true;
    const client = getSupabaseBrowserClient();
    if (!client) return false;
    const { error } = await client.rpc("accept_trip_invite", { p_token: inviteToken });
    if (error) { setMessage("You’re signed in, but this invitation is invalid, expired, or belongs to a different email."); return false; }
    return true;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setLoading(true); setMessage("");
    const isNewAccount = creatingAccount;
    const result = isNewAccount
      ? await client.auth.signUp({ email, password })
      : await client.auth.signInWithPassword({ email, password });
    if (result.error) {
      setLoading(false);
      const alreadyRegistered = /already registered|already exists|registered/i.test(result.error.message);
      const needsConfirmation = /email.*not confirmed|email not confirmed|not confirmed/i.test(result.error.message);
      setMessage(needsConfirmation
        ? "This account needs one final email confirmation because it was created before confirmation was turned off. Open the original confirmation email once, then sign in with this password."
        : isNewAccount
          ? alreadyRegistered
            ? "That email already has a TripBoard account. Choose “Already have an account? Sign in” below."
            : "We couldn’t create that account. Try a longer password or use a different email."
          : "That email or password isn’t recognised. Try again or create an account.");
      return;
    }
    if (!result.data.session) {
      setLoading(false);
      setMessage("Account created. Turn off email confirmation in Supabase to use password sign-in without an email link.");
      return;
    }
    if (await acceptInvite()) window.location.href = "/today";
    else setLoading(false);
  };

  const requestPasswordReset = async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !email) { setMessage("Enter your email address first, then choose Forgot password."); return; }
    setLoading(true); setMessage("");
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
    setLoading(false);
    setMessage(error ? "We couldn’t send a recovery email yet. Wait a few minutes and try again." : "Recovery email sent. Open its link once to choose a new password.");
  };

  const saveRecoveredPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) { setMessage("The two passwords do not match."); return; }
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setLoading(true); setMessage("");
    const { error } = await client.auth.updateUser({ password });
    if (error) { setLoading(false); setMessage("Your password could not be updated. Request a fresh recovery email and try again."); return; }
    window.location.href = "/today";
  };

  const isNewAccount = creatingAccount;
  const title = recoveryMode ? "Choose a new password" : inviteToken ? (creatingAccount ? "Join your shared trip" : "Sign in to join the trip") : creatingAccount ? "Create your account" : "Welcome back";
  const description = recoveryMode
    ? "This one-time recovery link is only for changing your password."
    : inviteToken
    ? creatingAccount ? "Use the invited email address and choose a password to join the shared trip." : "Use the invited email address and your existing password to join the shared trip."
    : creatingAccount
      ? "Create a private account once. This device stays signed in afterwards."
      : "Sign in with your email and password. This device stays signed in until you log out.";

  return <main className="login-page"><ThemeToggle className="login-theme-toggle" /><section className="login-brand"><a href="/today" className="brand"><span className="brand-mark"><Plane size={18}/></span><span>TripBoard</span></a><div><p className="eyebrow">TRAVEL IN STEP</p><h1>Your whole trip,<br/>right when you need it.</h1><p>One private place for the plan, must-dos, tickets, and money, shared in real time.</p></div><ul><li><Check/>Shared trip progress</li><li><Check/>Offline-ready itinerary</li><li><Check/>Money without double-counting</li></ul></section><section className="login-form-wrap"><div className="login-card"><span className="login-icon"><ShieldCheck size={23}/></span><h2>{title}</h2><p>{description}</p>{!configured ? <div className="setup-needed"><KeyRound size={20}/><strong>Supabase setup needed</strong><p>Add the public Supabase URL and anonymous key to enable private accounts.</p><a href="/today">Continue with preview data <ArrowRight size={15}/></a></div> : recoveryMode ? <form className="form-stack" onSubmit={saveRecoveredPassword}><label>New password<div className="input-with-icon"><LockKeyhole size={16}/><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} placeholder="At least 6 characters" required autoFocus/></div></label><label>Confirm new password<div className="input-with-icon"><LockKeyhole size={16}/><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} placeholder="Repeat your password" required/></div></label><button className="button primary full" disabled={loading}>{loading ? "Saving…" : "Save password & sign in"}</button></form> : <form className="form-stack" onSubmit={submit}><label>Email address<div className="input-with-icon"><Mail size={16}/><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required autoFocus/></div></label><label>Password<div className="input-with-icon"><LockKeyhole size={16}/><input type="password" autoComplete={isNewAccount ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} placeholder="At least 6 characters" required/></div></label><button className="button primary full" disabled={loading}>{loading ? "Please wait…" : inviteToken ? (creatingAccount ? "Create account & join trip" : "Sign in & join trip") : creatingAccount ? "Create account" : "Sign in"}</button>{!creatingAccount && <button type="button" className="text-button" onClick={() => void requestPasswordReset()}>Forgot password?</button>}<button type="button" className="text-button" onClick={() => { setCreatingAccount((value) => !value); setMessage(""); }}>{creatingAccount ? "Already have an account? Sign in" : inviteToken ? "Need an account? Create one" : "New to TripBoard? Create an account"}</button></form>}{message && <div className="form-error" role="alert">{message}</div>}<small className="privacy-note">Your password stays private. This device remains securely signed in until you log out or clear its browser data.</small></div></section></main>;
}
