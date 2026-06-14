"use client";

import { useState } from "react";
import { useAppStore } from "./store";

const mono = "'Space Mono', 'Courier New', monospace";
const serif = "Georgia, 'Times New Roman', serif";

export default function SignInPage() {
  const navigate = useAppStore((s) => s.navigate);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      navigate({ page: "watchnow" });
    }, 1500);
  };

  return (
    <div className="lu-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ width: "100%", maxWidth: 440, padding: "0 24px", animation: "luFadeUp 0.7s ease both" }}>
        {/* Back link */}
        <button
          onClick={() => navigate({ page: "watchnow" })}
          className="flex items-center gap-2 mb-8 transition-colors"
          style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M10 6H2M2 6L5 3M2 6L5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          BACK TO LUFFY UNIVERSE
        </button>

        {/* Card */}
        <div className="lu-signin-card" style={{ padding: 32 }}>
          {/* Accent line */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, #f5a623, transparent)", opacity: 0.5 }} />

          {/* Header */}
          <div className="flex items-center justify-between mb-6" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.15em", color: "rgba(255,255,255,0.45)" }}>
            <span>SESSION / {mode === "signin" ? "SIGN IN" : "CREATE"}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.4 }}>
              <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="white" strokeWidth="1.3" />
              <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="white" strokeWidth="1.3" />
            </svg>
          </div>

          {/* Title */}
          <h2 style={{ fontFamily: serif, fontSize: 28, fontWeight: 900, lineHeight: 1.2, marginBottom: 6, color: "#fff" }}>
            {mode === "signin" ? (
              <>Sign in to <em style={{ color: "#f5a623", fontStyle: "italic" }}>unlock</em></>
            ) : (
              <>Join the <em style={{ color: "#f5a623", fontStyle: "italic" }}>universe</em></>
            )}
          </h2>
          <p style={{ fontFamily: mono, fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 28 }}>
            {mode === "signin"
              ? "Welcome back, adventurer. Enter your credentials to continue."
              : "Create your account and start your journey today."}
          </p>

          {submitted ? (
            <div className="text-center py-8" style={{ animation: "luFadeUp 0.5s ease both" }}>
              <div className="mx-auto mb-4 flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p style={{ fontFamily: mono, fontSize: 12, color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em" }}>
                {mode === "signin" ? "AUTHENTICATED" : "ACCOUNT CREATED"}
              </p>
              <p style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>Redirecting...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 6 }}>USERNAME</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="strawhat_luffy"
                    required
                    style={{
                      width: "100%",
                      background: "#111116",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 3,
                      padding: "10px 14px",
                      color: "#fff",
                      fontFamily: mono,
                      fontSize: 12,
                      outline: "none",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "rgba(212,160,23,0.4)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}
                  />
                </div>
              )}
              <div>
                <label style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 6 }}>EMAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="luffy@grandline.io"
                  required
                  style={{
                    width: "100%",
                    background: "#111116",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 3,
                    padding: "10px 14px",
                    color: "#fff",
                    fontFamily: mono,
                    fontSize: 12,
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "rgba(212,160,23,0.4)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}
                />
              </div>
              <div>
                <label style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 6 }}>PASSWORD</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: "100%",
                    background: "#111116",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 3,
                    padding: "10px 14px",
                    color: "#fff",
                    fontFamily: mono,
                    fontSize: 12,
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "rgba(212,160,23,0.4)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-between"
                style={{
                  background: "#1e1e2e",
                  border: "1px solid rgba(212,160,23,0.3)",
                  borderRadius: 3,
                  padding: "14px 20px",
                  color: "#fff",
                  fontFamily: mono,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  marginTop: 8,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#252540";
                  e.currentTarget.style.borderColor = "#D4A017";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#1e1e2e";
                  e.currentTarget.style.borderColor = "rgba(212,160,23,0.3)";
                }}
              >
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 2H3a1 1 0 00-1 1v8a1 1 0 001 1h2M9 10l3-3-3-3M12 7H5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
                </div>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 10L10 2M10 2H4M10 2v6" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            </form>
          )}

          {/* Switch mode */}
          {!submitted && (
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <span style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em" }}>
                {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              </span>
              <button
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                style={{ fontFamily: mono, fontSize: 10, color: "#f5a623", letterSpacing: "0.05em", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
              >
                {mode === "signin" ? "Sign Up" : "Sign In"}
              </button>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: 20, fontFamily: mono, fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,255,255,0.15)", textAlign: "right" }}>
            LUFFY UNIVERSE / SECURE
          </div>
        </div>
      </div>
    </div>
  );
}
