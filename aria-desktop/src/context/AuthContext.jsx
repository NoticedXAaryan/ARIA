import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const saved = localStorage.getItem(`aria_setup_${firebaseUser.uid}`);
        setSetupComplete(saved === "true");
      } else {
        setSetupComplete(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const completeSetup = () => {
    if (user) {
      localStorage.setItem(`aria_setup_${user.uid}`, "true");
      setSetupComplete(true);
    }
  };

  const resetSetup = () => {
    if (user) {
      localStorage.removeItem(`aria_setup_${user.uid}`);
      setSetupComplete(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, setupComplete, completeSetup, resetSetup }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
