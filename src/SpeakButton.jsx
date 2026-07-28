// Bouton « écouter ». Deux tailles : « grand » pour le mot lui-même,
// discret pour les phrases. Cible tactile d'au moins 44 px dans les deux cas.
export default function SpeakButton({ texte, lire, grand = false, titre }) {
  if (!texte) return null;
  const label = titre || "Écouter";
  return (
    <button
      type="button"
      className={`speak-btn${grand ? " grand" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        lire(texte);
      }}
      aria-label={label}
      title={label}
    >
      <svg
        width={grand ? 26 : 18}
        height={grand ? 26 : 18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11 5 6 9H3v6h3l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
      {grand && <span>Écouter</span>}
    </button>
  );
}
