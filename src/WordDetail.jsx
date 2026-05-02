import WordImage from "./WordImage.jsx";

export default function WordDetail({
  word,
  vocab,
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
        <button className="detail-close" onClick={onClose} aria-label="Fermer">
          ×
        </button>

        <div className="detail-header">
          <WordImage url={word.url} search={word.search} size={220} />
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
