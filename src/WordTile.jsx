import WordImage from "./WordImage.jsx";

export default function WordTile({ word, isFavorite, onToggleFav, onClick, levelColors = {} }) {
  return (
    <div
      className="word-tile"
      style={{ position: "relative" }}
      onClick={onClick}
    >
      <button
        className="fav-badge fav-btn"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFav(word.id);
        }}
        aria-label="Favori"
      >
        {isFavorite ? "❤️" : "🤍"}
      </button>
      <WordImage url={word.url} search={word.search} size={218} />
      <div className="tile-footer">
        <span className="tile-word">{word.word}</span>
        {word.niveau && (
          <span
            className={`level-btn l${word.niveau}`}
            style={{
              color: levelColors[word.niveau],
              borderColor: levelColors[word.niveau],
            }}
          >
            {word.niveau}
          </span>
        )}
      </div>
    </div>
  );
}
