"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, KeyRound, Mail, Plane, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient, hasSupabaseConfiguration } from "../../lib/supabase/client";
import { ThemeToggle } from "../../components/ui/ThemeToggle";

export function LoginPage() {
  const configured = hasSupabaseConfiguration();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"EMAIL" | "CODE" | "ACCEPTING">("EMAIL");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  useEffect(() => { setInviteToken(new URLSearchParams(window.location.search).get("invite") ?? ""); }, []);

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault(); const client = getSupabaseBrowserClient(); if (!client) return;
    setLoading(true); setMessage("");
    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setLoading(false); if (error) setMessage("We couldn’t send the code. Check the email address and try again."); else setStage("CODE");
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); const client = getSupabaseBrowserClient(); if (!client) return;
    setLoading(true); setMessage("");
    const { error } = await client.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) { setLoading(false); setMessage("That code is invalid or expired. Request a new one and try again."); return; }
    if (inviteToken) {
      setStage("ACCEPTING"); const { error: inviteError } = await client.rpc("accept_trip_invite", { p_token: inviteToken });
      if (inviteError) { setLoading(false); setMessage("You’re signed in, but the invitation is invalid, expired, or belongs to a different email."); return; }
    }
    window.location.href = "/today";
  };

  return <main className="login-page"><ThemeToggle className="login-theme-toggle" /><section className="login-brand"><a href="/today" className="brand"><span className="brand-mark"><Plane size={18}/></span><span>TripBoard</span></a><div><p className="eyebrow">TRAVEL IN STEP</p><h1>Your whole trip,<br/>right when you need it.</h1><p>One private place for the plan, must-dos, tickets, and money—shared in real time.</p></div><ul><li><Check/>Shared trip progress</li><li><Check/>Offline-ready itinerary</li><li><Check/>Money without double-counting</li></ul></section><section className="login-form-wrap"><div className="login-card"><span className="login-icon"><ShieldCheck size={23}/></span><h2>{inviteToken ? "Join your shared trip" : "Welcome back"}</h2><p>{stage === "EMAIL" ? "Enter your email and we’ll send a six-digit sign-in code." : stage === "CODE" ? `Enter the code sent to ${email}.` : "Accepting your invitation…"}</p>{!configured ? <div className="setup-needed"><KeyRound size={20}/><strong>Supabase setup needed</strong><p>Add the public Supabase URL and anonymous key to enable private email sign-in.</p><a href="/today">Continue with preview data <ArrowRight size={15}/></a></div> : stage === "EMAIL" ? <form className="form-stack" onSubmit={sendCode}><label>Email address<div className="input-with-icon"><Mail size={16}/><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required autoFocus/></div></label><button className="button primary full" disabled={loading}>{loading ? "Sending…" : <>Send sign-in code <ArrowRight size={16}/></>}</button></form> : stage === "CODE" ? <form className="form-stack" onSubmit={verify}><label>Six-digit code<input className="otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" required autoFocus/></label><button className="button primary full" disabled={loading || code.length !== 6}>{loading ? "Checking…" : inviteToken ? "Sign in & join trip" : "Sign in"}</button><button type="button" className="text-button" onClick={() => { setStage("EMAIL"); setCode(""); }}>Use a different email</button></form> : <div className="login-wait"><span/><span/><span/></div>}{message && <div className="form-error" role="alert">{message}</div>}<small className="privacy-note">No password required. Your session stays securely signed in on this device until you log out.</small></div></section></main>;
}
