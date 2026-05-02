import { useEffect, useState, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
//  CODE ADMIN
//  Pour le changer, modifie cette constante puis sauvegarde.
//  ⚠️ Ce n'est PAS une vraie sécurité : le code est visible dans
//  le code source téléchargé par les navigateurs. C'est juste
//  une protection visuelle pour éviter les clics accidentels.
// ─────────────────────────────────────────────────────────────
const ADMIN_CODE = "1234";

const SS_KEY = "vocab_admin_session";

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      return sessionStorage.getItem(SS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [promptOpen, setPromptOpen] = useState(false);

  // Persistance (session uniquement)
  useEffect(() => {
    try {
      if (isAdmin) sessionStorage.setItem(SS_KEY, "1");
      else sessionStorage.removeItem(SS_KEY);
    } catch {}
  }, [isAdmin]);

  // Raccourcis clavier
  useEffect(() => {
    const handler = (e) => {
      // Ctrl+A (ou Cmd+A) ouvre la pop-up
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        // On évite d'intercepter quand on est dans un champ de saisie
        const tag = e.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        if (!isAdmin) setPromptOpen(true);
        return;
      }
      // Ctrl+Q (ou Cmd+Q) quitte le mode admin
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "q") {
        if (isAdmin) {
          e.preventDefault();
          setIsAdmin(false);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isAdmin]);

  const tryUnlock = useCallback((code) => {
    if (code === ADMIN_CODE) {
      setIsAdmin(true);
      setPromptOpen(false);
      return true;
    }
    return false;
  }, []);

  const closePrompt = useCallback(() => setPromptOpen(false), []);

  const exitAdmin = useCallback(() => setIsAdmin(false), []);

  return {
    isAdmin,
    promptOpen,
    tryUnlock,
    closePrompt,
    exitAdmin,
  };
}
