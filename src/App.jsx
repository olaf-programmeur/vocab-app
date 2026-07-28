import { useMemo, useState } from "react";
import { useVocab } from "./useVocab.js";
import { useAdmin } from "./useAdmin.js";
import AdminPrompt from "./AdminPrompt.jsx";
import WordImage from "./WordImage.jsx";
import WordTile from "./WordTile.jsx";
import WordDetail from "./WordDetail.jsx";
import ListView from "./ListView.jsx";
import FacetBar, { ORDRE } from "./FacetBar.jsx";
import Quiz from "./Quiz.jsx";
import ImportExport from "./ImportExport.jsx";
import "./styles.css";

const MODES = [
  { id: "trouver", icone: "🔎", label: "Trouver", titre: "Trouver un mot en répondant à des questions" },
  { id: "cartes", icone: "🟦", label: "Cartes", titre: "Parcourir les images par thème" },
  { id: "liste", icone: "📋", label: "Liste", titre: "Parcourir la liste des thèmes" },
  { id: "listes", icone: "⭐", label: "Mes listes", titre: "Ouvrir une liste toute faite" },
];

export default function App() {
  const vocab = useVocab();
  const admin = useAdmin();

  // Navigation
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  // Pile de fiches ouvertes : la dernière est affichée, les précédentes sont l'historique
  const [wordStack, setWordStack] = useState([]);
  const selectedWord = wordStack[wordStack.length - 1] || null;

  const openWord = (w) => setWordStack([w]);                  // ouvrir une fiche (depuis la liste/les cartes)
  const pushWord = (w) => setWordStack((s) => [...s, w]);     // suivre un mot relié → empile
  // Flèche : referme toutes les fiches liées d'un coup → retour au mot de base ;
  // si on est déjà sur le mot de base, ferme la fiche.
  const popWord = () =>
    setWordStack((s) => (s.length > 1 ? s.slice(0, 1) : []));
  const closeWords = () => setWordStack([]);                  // tout fermer (clic en dehors)

  // UI
  const [mode, setMode] = useState("cartes");
  const changerMode = (m) => {
    setMode(m);
    // Changer d'écran remet le contexte à zéro : sans cela on se retrouve
    // dans une liste filtrée par une question posée sur un autre écran.
    setSelectedCat(null);
    setSelectedSub(null);
    setShowFavorites(false);
    setActiveList(null);
    setFacets({});
  };
  const viewMode = mode === "liste" ? "list" : "grid";
  const [showSubsInList, setShowSubsInList] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);
  // Un axe = une famille de tags ; au plus une valeur choisie par axe.
  const [facets, setFacets] = useState({});
  const toggleFacet = (famille, valeur) =>
    setFacets((p) => {
      const n = { ...p };
      if (n[famille] === valeur) delete n[famille];
      else n[famille] = valeur;
      return n;
    });
  const hasFacets = Object.keys(facets).length > 0;
  const [activeList, setActiveList] = useState(null);

  // Modales
  const [quizOpen, setQuizOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);

  // Minuscules + suppression des accents (é→e, ç→c…) pour une recherche tolérante
  const normalize = (s) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(new RegExp("[\\u0300-\\u036f]", "g"), "");

  // La recherche porte aussi sur les synonymes : « maman » doit ramener
  // « la mère - la maman », « laitue » doit ramener « la salade verte ».
  const trouveDans = (w, q) => {
    if (normalize(w.word).includes(q)) return null;          // trouvé par le mot lui-même
    const syn = (w.synonyms || []).find((s) => normalize(s).includes(q));
    return syn || undefined;                                  // undefined = pas trouvé
  };

  const matchesFilter = (w) => {
    if (levelFilter && w.niveau !== levelFilter) return false;
    for (const [famille, valeur] of Object.entries(facets)) {
      const vals = famille === "nature" ? [w.nature] : (w.facets && w.facets[famille]) || [];
      if (!vals.includes(valeur)) return false;
    }
    if (search) {
      const q = normalize(search.trim());
      if (q && trouveDans(w, q) === undefined) return false;
    }
    if (showFavorites && !vocab.isFavorite(w.id)) return false;
    return true;
  };

  // Score de pertinence : 0 = le plus exact … 3 = le moins exact
  const searchScore = (w, q) => {
    const nw = normalize(w.word);
    if (nw === q) return 0;                                   // mot identique
    if (nw.startsWith(q)) return 1;                           // commence par la recherche
    const tokens = nw.split(/[\s'’\-]+/);
    if (tokens.some((t) => t.startsWith(q))) return 2;        // début d'un des mots
    return 3;                                                 // contenu ailleurs dans le mot
  };

  // Trie une liste de mots du plus pertinent au moins pertinent
  const sortByRelevance = (list) => {
    const q = normalize(search.trim());
    if (!q) return list;
    return [...list].sort((a, b) => {
      const d = searchScore(a, q) - searchScore(b, q);
      if (d !== 0) return d;
      const dl = normalize(a.word).length - normalize(b.word).length; // le plus court d'abord
      if (dl !== 0) return dl;
      return a.word.localeCompare(b.word, "fr");
    });
  };

  const visibleWords = useMemo(() => {
    let result;
    if (activeList) {
      const l = (vocab.lists || []).find((x) => x.id === activeList);
      result = (l ? l.wordIds : [])
        .map((id) => vocab.wordById.get(id))
        .filter(Boolean)
        .filter(matchesFilter);
    } else if (showFavorites) {
      result = vocab.words.filter(matchesFilter);
    } else if (selectedSub) {
      result = (vocab.wordsBySubcategory.get(selectedSub.id) || []).filter(
        matchesFilter
      );
    } else if (selectedCat) {
      result = (vocab.wordsByCategory.get(selectedCat.id) || []).filter(
        matchesFilter
      );
    } else if (search || levelFilter || hasFacets) {
      result = vocab.words.filter(matchesFilter);
    } else {
      return [];
    }
    // En recherche, on classe du plus exact au moins exact
    return search ? sortByRelevance(result) : result;
  }, [
    selectedSub,
    selectedCat,
    search,
    levelFilter,
    facets,
    activeList,
    showFavorites,
    vocab.words,
    vocab.wordsBySubcategory,
    vocab.wordsByCategory,
    vocab.favorites,
  ]);

  // Axes proposés : la nature d'abord (colonne de « Mots »), puis les familles
  // de tags, dans l'ordre du plus général au plus fin.
  const facetFamilies = useMemo(() => {
    const fams = [];
    if ((vocab.natures || []).length > 0) {
      fams.push({ id: "nature", tags: vocab.natures });
    }
    for (const f of vocab.tagFamilies || []) fams.push(f);
    return fams.sort((a, b) => {
      const ia = ORDRE.indexOf(a.id), ib = ORDRE.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [vocab.natures, vocab.tagFamilies]);

  // Ensemble sur lequel les axes comptent : tout ce qui est filtré SAUF les
  // axes eux-mêmes, pour que les nombres affichés soient ceux qu'on obtiendra.
  const facetPool = useMemo(() => {
    const listeActive = activeList
      ? (vocab.lists || []).find((x) => x.id === activeList)
      : null;
    const base = listeActive
      ? listeActive.wordIds.map((id) => vocab.wordById.get(id)).filter(Boolean)
      : selectedSub
      ? vocab.wordsBySubcategory.get(selectedSub.id) || []
      : selectedCat
      ? vocab.wordsByCategory.get(selectedCat.id) || []
      : vocab.words;
    const q = search ? normalize(search.trim()) : "";
    return base.filter((w) => {
      if (levelFilter && w.niveau !== levelFilter) return false;
      if (showFavorites && !vocab.isFavorite(w.id)) return false;
      if (q && trouveDans(w, q) === undefined) return false;
      return true;
    });
  }, [
    selectedSub, selectedCat, search, levelFilter, showFavorites, activeList,
    vocab.words, vocab.wordsBySubcategory, vocab.wordsByCategory,
    vocab.lists, vocab.wordById, vocab.favorites,
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
        <div className="search-wrap">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Rechercher un mot…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearch("")}
              aria-label="Effacer la recherche"
              title="Effacer la recherche"
            >
              ×
            </button>
          )}
        </div>

        {/* Quatre façons d'arriver au mot, séparées : chercher en répondant à
            des questions, parcourir les images, parcourir l'arborescence, ou
            ouvrir une liste toute faite. Chacune a son écran. */}
        <div className="toolbar-group modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`btn-pill${mode === m.id ? " active" : ""}`}
              onClick={() => changerMode(m.id)}
              title={m.titre}
            >
              {m.icone} {m.label}
            </button>
          ))}
        </div>

        {mode === "liste" && (
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
          {vocab.allLevels.map((lvl) => {
            const c = vocab.levelColors[lvl];
            const active = levelFilter === lvl;
            return (
              <button
                key={lvl}
                className={`level-btn l${lvl} ${active ? "active" : ""}`}
                style={{
                  color: active ? "#fff" : c,
                  borderColor: c,
                  background: active ? c : undefined,
                }}
                onClick={() => setLevelFilter(active ? null : lvl)}
              >
                {lvl}
              </button>
            );
          })}
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

      {/* Les questions n'apparaissent que sur l'écran « Trouver » : ailleurs,
          elles s'interposaient entre la personne et les images. */}
      {mode === "trouver" && (
        <FacetBar
          familles={facetFamilies}
          pool={facetPool}
          actifs={facets}
          onToggle={toggleFacet}
          wordById={vocab.wordById}
        />
      )}

      {mode === "listes" && (
        <div className="listes-choix">
          {(vocab.lists || []).map((l) => (
            <button
              key={l.id}
              className={`liste-carte${activeList === l.id ? " active" : ""}`}
              onClick={() => setActiveList(activeList === l.id ? null : l.id)}
            >
              <span className="liste-icone">{l.icon}</span>
              <span className="liste-label">{l.label}</span>
              <span className="liste-compte">{l.wordIds.length} mots</span>
            </button>
          ))}
          {(vocab.lists || []).length === 0 && (
            <div className="empty-state">
              Aucune liste pour l'instant. Elles se créent dans la feuille
              « Listes » du fichier de données.
            </div>
          )}
        </div>
      )}

      {mode === "trouver" && hasFacets && (
        <div className="facet-active">
          <button className="crumb" onClick={() => setFacets({})}>
            ✕ Tout afficher
          </button>
          <span className="facet-active-count">
            {visibleWords.length} mot{visibleWords.length > 1 ? "s" : ""}
          </span>
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
            onSelectWord={openWord}
            levelFilter={levelFilter}
            search={search}
            showSubs={showSubsInList}
          />
        ) : (
          <>
            {mode === "cartes" && !selectedCat && !showFavorites && !search && !levelFilter && (
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
              !(selectedCat && !selectedSub && subsOfSelectedCat.length > 0 && !search && !levelFilter && !hasFacets) && (
                <div className="word-grid">
                  {visibleWords.map((w, i) => (
                    <WordTile
                      key={`${w.id}-${i}`}
                      word={w}
                      isFavorite={vocab.isFavorite(w.id)}
                      onToggleFav={vocab.toggleFavorite}
                      onClick={() => openWord(w)}
                      levelColors={vocab.levelColors}
                    />
                  ))}
                </div>
              )}

            {(search || levelFilter || hasFacets || showFavorites) &&
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
          key={selectedWord.id}
          word={selectedWord}
          vocab={vocab}
          onBack={popWord}
          onClose={closeWords}
          onSelectWord={pushWord}
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
