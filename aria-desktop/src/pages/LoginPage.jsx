import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Button,
  Chip,
} from "@heroui/react";
import { Mail, Lock, User, Eye, EyeOff, Sparkles, Chrome } from "lucide-react";
import { loginWithEmail, signupWithEmail, loginWithGoogle } from "../lib/firebase";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        await signupWithEmail(email, password, name);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err) {
      const msg = err.code === "auth/user-not-found"
        ? "No account found with this email"
        : err.code === "auth/wrong-password"
        ? "Incorrect password"
        : err.code === "auth/email-already-in-use"
        ? "Email already registered"
        : err.code === "auth/weak-password"
        ? "Password must be at least 6 characters"
        : err.code === "auth/invalid-email"
        ? "Invalid email address"
        : err.message || "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError("Google sign-in failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "var(--aria-bg)",
      }}
    >
      {/* Floating orbs */}
      <div className="orb" style={{ width: 400, height: 400, background: "var(--aria-gradient-start)", top: "-10%", left: "-5%", animation: "float 25s ease-in-out infinite" }} />
      <div className="orb" style={{ width: 350, height: 350, background: "var(--aria-gradient-end)", bottom: "-15%", right: "-5%", animation: "float 30s ease-in-out infinite reverse" }} />
      <div className="orb" style={{ width: 200, height: 200, background: "#06b6d4", top: "50%", left: "60%", opacity: 0.15, animation: "float 20s ease-in-out infinite 5s" }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: "100%", maxWidth: 440, padding: "0 20px", zIndex: 10 }}
      >
        <div className="glass-strong glow-accent" style={{ borderRadius: 20, padding: "40px 32px 32px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              style={{
                width: 64, height: 64, borderRadius: 16,
                background: "linear-gradient(135deg, var(--aria-gradient-start), var(--aria-gradient-end))",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 12px",
                boxShadow: "0 8px 32px rgba(99, 102, 241, 0.3)",
              }}
            >
              <Sparkles size={32} color="white" />
            </motion.div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }} className="gradient-text">ARIA</h1>
            <p style={{ fontSize: 14, color: "var(--aria-text-muted)", marginTop: 4 }}>
              Anticipatory Reasoning & Intelligent Assistance
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={isSignUp ? "signup" : "login"}
              initial={{ opacity: 0, x: isSignUp ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isSignUp ? -20 : 20 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <Chip size="sm" variant="flat" color="secondary">
                  {isSignUp ? "Create your account" : "Welcome back"}
                </Chip>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {isSignUp && (
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 2, pointerEvents: "none" }}>
                      <User size={16} color="var(--aria-text-muted)" />
                    </div>
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={isSignUp}
                      style={{
                        width: "100%", height: 48, borderRadius: 12,
                        background: "var(--aria-surface)", border: "1px solid var(--aria-border)",
                        color: "var(--aria-text)", fontSize: 14, paddingLeft: 40, paddingRight: 14,
                        outline: "none", transition: "border-color 0.2s",
                      }}
                      onFocus={(e) => e.target.style.borderColor = "var(--aria-accent)"}
                      onBlur={(e) => e.target.style.borderColor = "var(--aria-border)"}
                    />
                  </div>
                )}

                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 2, pointerEvents: "none" }}>
                    <Mail size={16} color="var(--aria-text-muted)" />
                  </div>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                      width: "100%", height: 48, borderRadius: 12,
                      background: "var(--aria-surface)", border: "1px solid var(--aria-border)",
                      color: "var(--aria-text)", fontSize: 14, paddingLeft: 40, paddingRight: 14,
                      outline: "none", transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => e.target.style.borderColor = "var(--aria-accent)"}
                    onBlur={(e) => e.target.style.borderColor = "var(--aria-border)"}
                  />
                </div>

                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 2, pointerEvents: "none" }}>
                    <Lock size={16} color="var(--aria-text-muted)" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{
                      width: "100%", height: 48, borderRadius: 12,
                      background: "var(--aria-surface)", border: "1px solid var(--aria-border)",
                      color: "var(--aria-text)", fontSize: 14, paddingLeft: 40, paddingRight: 44,
                      outline: "none", transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => e.target.style.borderColor = "var(--aria-accent)"}
                    onBlur={(e) => e.target.style.borderColor = "var(--aria-border)"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", padding: 2,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} color="var(--aria-text-muted)" /> : <Eye size={16} color="var(--aria-text-muted)" />}
                  </button>
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      color: "var(--aria-danger)", fontSize: 13, textAlign: "center",
                      padding: "6px 12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.1)",
                    }}
                  >
                    {error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: "linear-gradient(135deg, var(--aria-gradient-start), var(--aria-gradient-end))",
                    color: "white", fontWeight: 600, fontSize: 15, height: 48, borderRadius: 12,
                    border: "none", cursor: loading ? "wait" : "pointer", marginTop: 4,
                    opacity: loading ? 0.7 : 1, transition: "opacity 0.2s",
                  }}
                >
                  {loading ? "..." : isSignUp ? "Create Account" : "Sign In"}
                </button>
              </form>
            </motion.div>
          </AnimatePresence>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--aria-border)" }} />
            <span style={{ fontSize: 12, color: "var(--aria-text-muted)", whiteSpace: "nowrap" }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: "var(--aria-border)" }} />
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            style={{
              width: "100%", height: 48, borderRadius: 12,
              background: "transparent", border: "1px solid var(--aria-border)",
              color: "var(--aria-text)", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", gap: 8,
              fontWeight: 500, fontSize: 14, transition: "border-color 0.2s",
            }}
            onMouseEnter={(e) => e.target.style.borderColor = "var(--aria-accent)"}
            onMouseLeave={(e) => e.target.style.borderColor = "var(--aria-border)"}
          >
            <Chrome size={18} /> Google Account
          </button>

          <p style={{ textAlign: "center", fontSize: 13, color: "var(--aria-text-muted)", marginTop: 20 }}>
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
              style={{
                background: "none", border: "none", color: "var(--aria-accent-light)",
                cursor: "pointer", fontWeight: 600, fontSize: 13,
              }}
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "var(--aria-text-muted)", marginTop: 20, opacity: 0.6 }}>
          Your data stays on your device. Privacy-first by design.
        </p>
      </motion.div>
    </div>
  );
}
