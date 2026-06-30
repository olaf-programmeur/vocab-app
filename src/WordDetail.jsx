import WordGallery from "./WordGallery.jsx";

export default function WordDetail({
  word,
  vocab,
  onBack,
  onClose,
  onSelectWord,
}) {
  const connections = vocab.getConnections(word.id);
  const isFav = vocab.isFavorite(word.id);

  // Catégories d'appartenance (lisibles)
  const subcatLabels = (word.subcategoryIds || [])
    .map((id) => vocab.subcategoryById.get(id))
    .filter(Boolean);
  const catLabels = (word.categoryIds || [])
    .map((id) => vocab.categoryById.get(id))
    .filter(Boolean);

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-card" onClick={(e) => e.stopPropagation()}>
        <button
          className="detail-close"
          onClick={onBack}
          aria-label="Fermer la fiche"
          title="Fermer la fiche"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="detail-header">
          <WordGallery urls={word.urls} search={word.search} size={280} />
          <div className="detail-title-block">
            <h2 className="detail-word">{word.word}</h2>
            <div className="detail-meta">
              <span className={`level-btn l${word.niveau}`}>{word.niveau}</span>
              <button
                className="fav-btn"
                onClick={() => vocab.toggleFavorite(word.id)}
              >
                {isFav ? "❤️ Retirer des favoris" : "🤍 Ajouter aux favoris"}
              </button>
            </div>
            {(subcatLabels.length > 0 || catLabels.length > 0) && (
              <div className="detail-cats">
                {subcatLabels.map((s) => (
                  <span key={s.id} className="cat-chip" style={{ background: s.color }}>
                    {s.emoji} {s.label}
                  </span>
                ))}
                {catLabels.map((c) => (
                  <span key={c.id} className="cat-chip" style={{ background: c.color }}>
                    {c.emoji} {c.label}
                  </span>
                ))}
              </div>
            )}
            {word.tags && word.tags.length > 0 && (
              <div className="detail-tags">
                {word.tags.map((t) => (
                  <span key={t} className="tag-chip">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {word.definition && (
          <div className="detail-section">
            <h3>Définition</h3>
            <p>{word.definition}</p>
          </div>
        )}
        {word.exemple && (
          <div className="detail-section">
            <h3>Exemple</h3>
            <p style={{ fontStyle: "italic" }}>« {word.exemple} »</p>
          </div>
        )}
        {word.astuce && (
          <div className="detail-section">
            <h3>💡 Astuce</h3>
            <p>{word.astuce}</p>
          </div>
        )}

        {connections.length > 0 && (
          <div className="detail-section">
            <h3>🔗 Mots reliés</h3>
            <div className="connections">
              {connections.map((c) => (
                <button
                  key={c.id}
                  className="connection-chip"
                  onClick={() => onSelectWord(c)}
                >
                  {c.word}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
