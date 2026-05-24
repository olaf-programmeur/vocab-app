import WordImage from "./WordImage.jsx";

export default function WordTile({ word, isFavorite, onToggleFav, onClick }) {
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
      <WordImage url={word.url} search={word.search} size={180} />
      <span className="tile-word">{word.word}</span>
      <span className={`level-btn l${word.niveau}`}>{word.niveau}</span>
    </div>
  );
}
