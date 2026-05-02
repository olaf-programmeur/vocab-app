import { useMemo, useState } from "react";
import { useVocab } from "./useVocab.js";
import { useAdmin } from "./useAdmin.js";
import AdminPrompt from "./AdminPrompt.jsx";
import WordImage from "./WordImage.jsx";
import WordTile from "./WordTile.jsx";
import WordDetail from "./WordDetail.jsx";
import ListView from "./ListView.jsx";
import Quiz from "./Quiz.jsx";
import ImportExport from "./ImportExport.jsx";
import "./styles.css";

export default function App() {
  const vocab = useVocab();
  const admin = useAdmin();

  // Navigation
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const [selectedWord, setSelectedWord] = useState(null);

  // UI
  const [viewMode, setViewMode] = useState("grid");
  const [showSubsInList, setShowSubsInList] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [tagFilter, setTagFilter] = useState(null);

  // Modales
  const [quizOpen, setQuizOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);

  const matchesFilter = (w) => {
    if (levelFilter && w.niveau !== levelFilter) return false;
    if (tagFilter && !(w.tags || []).includes(tagFilter)) return false;
    if (search && !w.word.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (showFavorites && !vocab.isFavorite(w.id)) return false;
    return true;
  };

  const visibleWords = useMemo(() => {
    if (showFavorites) {
      return vocab.words.filter(matchesFilter);
    }
    if (selectedSub) {
      return (vocab.wordsBySubcategory.get(selectedSub.id) || []).filter(
        matchesFilter
      );
    }
    if (selectedCat) {
      return (vocab.wordsByCategory.get(selectedCat.id) || []).filter(
        matchesFilter
      );
    }
    if (search || levelFilter || tagFilter) {
      return vocab.words.filter(matchesFilter);
    }
    return [];
  }, [
    selectedSub,
    selectedCat,
    search,
    levelFilter,
    tagFilter,
    showFavorites,
    vocab.words,
    vocab.wordsBySubcategory,
    vocab.wordsByCategory,
    vocab.favorites,
  ]);

  const subsOfSelectedCat = selectedCat
    ? vocab.subcategoriesByCategory.get(selectedCat.id) || []
    : [];

  const handleBack = () => {
    if (selectedSub) setSelectedSub(null);
    else if (selectedCat) setSelectedCat(null);
  };

  const quizPool = useMemo(() => {
    if (selectedSub)
      return vocab.wordsBySubcategory.get(selectedSub.id) || [];
    if (selectedCat)
      return vocab.wordsByCategory.get(selectedCat.id) || [];
    return vocab.words;
  }, [selectedSub, selectedCat, vocab.words, vocab.wordsBySubcategory, vocab.wordsByCategory]);

  // ─── ÉCRAN DE CHARGEMENT ───
  if (vocab.loading) {
    return (
      <div className="app">
        <header className="app-header">
          <h1 className="app-title">📚 Mon vocabulaire</h1>
        </header>
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Chargement du vocabulaire…</p>
        </div>
      </div>
    );
  }

  // ─── ÉCRAN D'ERREUR ───
  if (vocab.error) {
    return (
      <div className="app">
        <header className="app-header">
          <h1 className="app-title">📚 Mon vocabulaire</h1>
        </header>
        <div className="error-state">
          <h2>⚠️ Impossible de charger les données</h2>
          <p>{vocab.error}</p>
          <p style={{ marginTop: 12 }}>
            Vérifie que le fichier <code>public/data.xlsx</code> existe bien dans
            le projet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">📚 Mon vocabulaire</h1>
        <div className="app-stats">
          {vocab.words.length} mots · {vocab.categories.length} catégories
        </div>
      </header>

      <div className="toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="🔍 Rechercher un mot…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="toolbar-group">
          <button
            className={`btn-pill ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
            title="Affichage cartes"
          >
            🟦 Cartes
          </button>
          <button
            className={`btn-pill ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
            title="Affichage liste"
          >
            📋 Liste
          </button>
        </div>

        {viewMode === "list" && (
          <label className="list-toggle">
            <input
              type="checkbox"
              checked={showSubsInList}
              onChange={(e) => setShowSubsInList(e.target.checked)}
            />
            <span>Sous-cat.</span>
          </label>
        )}

        <div className="toolbar-group">
          {["A1", "A2", "B1", "B2"].map((lvl) => (
            <button
              key={lvl}
              className={`level-btn l${lvl} ${
                levelFilter === lvl ? "active" : ""
              }`}
              onClick={() =>
                setLevelFilter(levelFilter === lvl ? null : lvl)
              }
            >
              {lvl}
            </button>
          ))}
          {levelFilter && (
            <button className="btn-pill" onClick={() => setLevelFilter(null)}>
              ✕
            </button>
          )}
        </div>

        <button
          className={`btn-pill ${showFavorites ? "active" : ""}`}
          onClick={() => {
            setShowFavorites(!showFavorites);
            setSelectedCat(null);
            setSelectedSub(null);
          }}
        >
          ❤️ Favoris ({vocab.favorites.length})
        </button>

        <button className="btn-secondary" onClick={() => setQuizOpen(true)}>
          🎯 Quiz
        </button>

        {admin.isAdmin && (
          <>
            <button
              className="btn-secondary"
              onClick={() => setImportExportOpen(true)}
              title="Comparer un fichier Excel"
            >
              📊 Excel
            </button>

            <button
              className="btn-pill admin-badge"
              onClick={admin.exitAdmin}
              title="Quitter le mode admin (Ctrl+Q)"
            >
              🔓 Admin
            </button>
          </>
        )}
      </div>

      {vocab.allTags.length > 0 && (
        <div className="tag-bar">
          <span className="tag-bar-label">Tags :</span>
          {vocab.allTags.map((t) => (
            <button
              key={t}
              className={`tag-chip clickable ${tagFilter === t ? "active" : ""}`}
              onClick={() => setTagFilter(tagFilter === t ? null : t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {(selectedCat || selectedSub || showFavorites) && (
        <div className="breadcrumb">
          <button className="crumb" onClick={() => {
            setSelectedCat(null);
            setSelectedSub(null);
            setShowFavorites(false);
          }}>
            🏠 Accueil
          </button>
          {showFavorites && <span className="crumb active">❤️ Favoris</span>}
          {selectedCat && (
            <>
              <span className="crumb-sep">›</span>
              <button
                className={selectedSub ? "crumb" : "crumb active"}
                onClick={() => setSelectedSub(null)}
              >
                {selectedCat.emoji} {selectedCat.label}
              </button>
            </>
          )}
          {selectedSub && (
            <>
              <span className="crumb-sep">›</span>
              <span className="crumb active">
                {selectedSub.emoji} {selectedSub.label}
              </span>
            </>
          )}
        </div>
      )}

      <main className="main-content">
        {viewMode === "list" && !selectedCat && !selectedSub && !showFavorites ? (
          <ListView
            vocab={vocab}
            onSelectWord={setSelectedWord}
            levelFilter={levelFilter}
            search={search}
            showSubs={showSubsInList}
          />
        ) : (
          <>
            {!selectedCat && !showFavorites && !search && !levelFilter && !tagFilter && (
              <div className="cat-grid">
                {vocab.categories.map((cat) => {
                  const subs = vocab.subcategoriesByCategory.get(cat.id) || [];
                  const wordsInCat = vocab.wordsByCategory.get(cat.id) || [];
                  const count = wordsInCat.length;
                  const previewItems =
                    subs.length > 0
                      ? subs.slice(0, 5).map((s) => ({
                          label: s.label,
                          emoji: s.emoji,
                          color: s.color,
                          isSub: true,
                        }))
                      : wordsInCat.slice(0, 5).map((w) => ({
                          label: w.word,
                          isSub: false,
                        }));
                  return (
                    <div
                      key={cat.id}
                      className="cat-tile"
                      style={{ "--cat-color": cat.color }}
                      onClick={() => setSelectedCat(cat)}
                    >
                      <div className="cat-tile-img">
                        <WordImage url={cat.url} search={cat.cover} size={160} />
                      </div>
                      <div className="cat-tile-info">
                        <div className="cat-tile-head">
                          <span className="cat-emoji">{cat.emoji}</span>
                          <span className="cat-label">{cat.label}</span>
                        </div>
                        <div className="cat-preview">
                          {previewItems.map((item) => (
                            <span
                              key={item.label}
                              className="prev-tag"
                              style={
                                item.isSub
                                  ? {
                                      background: (item.color || cat.color) + "18",
                                      color: item.color || cat.color,
                                      borderColor: (item.color || cat.color) + "44",
                                    }
                                  : undefined
                              }
                            >
                              {item.isSub ? `${item.emoji || "📁"} ` : ""}
                              {item.label}
                            </span>
                          ))}
                        </div>
                        <div className="cat-count">{count} mots</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedCat && !selectedSub && subsOfSelectedCat.length > 0 && (
              <div className="cat-grid">
                {subsOfSelectedCat.map((sub) => {
                  const subWords = vocab.wordsBySubcategory.get(sub.id) || [];
                  const count = subWords.length;
                  const previewItems = subWords
                    .slice(0, 5)
                    .map((w) => ({ label: w.word }));
                  return (
                    <div
                      key={sub.id}
                      className="cat-tile small"
                      style={{ "--cat-color": sub.color }}
                      onClick={() => setSelectedSub(sub)}
                    >
                      <div className="cat-tile-img">
                        <WordImage url={sub.url} search={sub.cover} size={140} />
                      </div>
                      <div className="cat-tile-info">
                        <div className="cat-tile-head">
                          <span className="cat-emoji">{sub.emoji}</span>
                          <span className="cat-label">{sub.label}</span>
                        </div>
                        <div className="cat-preview">
                          {previewItems.map((item) => (
                            <span key={item.label} className="prev-tag">
                              {item.label}
                            </span>
                          ))}
                        </div>
                        <div className="cat-count">{count} mots</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {visibleWords.length > 0 &&
              !(selectedCat && !selectedSub && subsOfSelectedCat.length > 0 && !search && !levelFilter && !tagFilter) && (
                <div className="word-grid">
                  {visibleWords.map((w) => (
                    <WordTile
                      key={w.id}
                      word={w}
                      isFavorite={vocab.isFavorite(w.id)}
                      onToggleFav={vocab.toggleFavorite}
                      onClick={() => setSelectedWord(w)}
                    />
                  ))}
                </div>
              )}

            {(search || levelFilter || tagFilter || showFavorites) &&
              visibleWords.length === 0 &&
              !selectedCat && (
                <div className="empty-state">
                  Aucun mot ne correspond à ta recherche.
                </div>
              )}
          </>
        )}
      </main>

      {(selectedCat || selectedSub) && (
        <button className="float-back" onClick={handleBack}>
          ← Retour
        </button>
      )}

      {selectedWord && (
        <WordDetail
          word={selectedWord}
          vocab={vocab}
          onClose={() => setSelectedWord(null)}
          onSelectWord={setSelectedWord}
        />
      )}

      {quizOpen && (
        <Quiz
          wordsPool={quizPool}
          onClose={() => setQuizOpen(false)}
        />
      )}

      {importExportOpen && (
        <ImportExport
          vocab={vocab}
          onClose={() => setImportExportOpen(false)}
        />
      )}

      {admin.promptOpen && (
        <AdminPrompt
          onSubmit={admin.tryUnlock}
          onCancel={admin.closePrompt}
        />
      )}
    </div>
  );
}
