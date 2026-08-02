import WordGallery from "./WordGallery.jsx";
import SpeakButton from "./SpeakButton.jsx";
import { useSpeech } from "./useSpeech.js";

export default function WordDetail({
  word,
  vocab,
  onBack,
  onClose,
  onSelectWord,
}) {
  const connections = vocab.getConnections(word.id);
  const isFav = vocab.isFavorite(word.id);
  const { supported: voixDispo, lire } = useSpeech();

  // Les phrases viennent toutes de la feuille « Phrases ».
  const phrases = word.phrases || [];

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
            {/* Sur un téléphone, chaque bloc empilé repoussait les mots reliés
                hors de l'écran. Écoute, favori et catégorie tiennent sur une
                seule ligne, qui se replie d'elle-même si la place manque.
                Les tags ne sont pas affichés : ils servent à filtrer, les lire
                n'apprend rien et ajoute du texte à déchiffrer. */}
            <div className="detail-actions">
              {voixDispo && (
                <SpeakButton
                  texte={word.word}
                  lire={lire}
                  grand
                  titre={`Écouter « ${word.word} »`}
                />
              )}
              <button
                className="fav-btn"
                onClick={() => vocab.toggleFavorite(word.id)}
                title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                {isFav ? "❤️ Favori" : "🤍 Favori"}
              </button>
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
          </div>
        </div>

        {/* Les mots reliés servent à circuler : ils passent avant le reste et
            ne sont jamais repliés. */}
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

        {/* Un bloc distinct par phrase : deux exemples ne doivent jamais se
            lire comme une seule phrase. */}
        {phrases.length > 0 && (
          <div className="detail-section">
            <h3>{phrases.some((p) => p.type === "expression") ? "Exemples et expressions" : "Exemples"}</h3>
            <div className="phrases">
              {phrases.map((p, i) => (
                <div key={i} className={`phrase phrase-${p.type}`}>
                  <span>{p.texte}</span>
                  {voixDispo && <SpeakButton texte={p.texte} lire={lire} titre="Écouter la phrase" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {word.synonyms && word.synonyms.length > 0 && (
          <div className="detail-section">
            <h3>On dit aussi</h3>
            <div className="connections">
              {word.synonyms.map((s) => (
                <span key={s} className="synonym-chip">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Replié par défaut : utile surtout à l'accompagnant. */}
        {word.definition && (
          <details className="detail-fold">
            <summary>Voir la définition</summary>
            <p>
              {word.definition}
              {voixDispo && (
                <SpeakButton texte={word.definition} lire={lire} titre="Écouter la définition" />
              )}
            </p>
          </details>
        )}
        {word.astuce && (
          <details className="detail-fold">
            <summary>💡 Voir l'astuce</summary>
            <p>{word.astuce}</p>
          </details>
        )}

      </div>
    </div>
  );
}
