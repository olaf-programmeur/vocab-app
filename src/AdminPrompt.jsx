import { useEffect, useRef, useState } from "react";

export default function AdminPrompt({ onSubmit, onCancel }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const ok = onSubmit(code);
    if (!ok) {
      setError(true);
      setCode("");
      // Petite vibration pour indiquer l'erreur
      setTimeout(() => setError(false), 600);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="detail-overlay" onClick={onCancel}>
      <div
        className="detail-card admin-prompt"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="detail-close" onClick={onCancel} aria-label="Fermer">
          ×
        </button>
        <h2>🔒 Mode administration</h2>
        <p style={{ color: "var(--text2)", fontSize: "0.9rem", marginBottom: 16 }}>
          Entre le code d'accès pour activer les fonctions d'administration.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(false);
            }}
            className={`admin-code-input ${error ? "error" : ""}`}
            placeholder="Code"
            autoComplete="off"
          />
          {error && (
            <div className="admin-error">❌ Code incorrect</div>
          )}
          <div className="form-actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={!code}>
              Valider
            </button>
          </div>
        </form>
        <div
          style={{
            fontSize: "0.78rem",
            color: "var(--text2)",
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
          }}
        >
          💡 Astuce : <kbd>Ctrl+Q</kbd> pour quitter le mode admin une fois activé.
        </div>
      </div>
    </div>
  );
}
