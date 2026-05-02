import { useState } from "react";

export default function ListView({
  vocab,
  onSelectWord,
  levelFilter,
  search,
  showSubs = true,
}) {
  const [openCats, setOpenCats] = useState({});
  const [openSubs, setOpenSubs] = useState({});

  const toggleCat = (id) =>
    setOpenCats((p) => ({ ...p, [id]: !p[id] }));
  const toggleSub = (id) =>
    setOpenSubs((p) => ({ ...p, [id]: !p[id] }));

  const matchesFilter = (w) => {
    if (levelFilter && w.niveau !== levelFilter) return false;
    if (search && !w.word.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  };

  return (
    <div className="list-view">
      {vocab.categories.map((cat) => {
        const subs = vocab.subcategoriesByCategory.get(cat.id) || [];
        const wordsInCat = (vocab.wordsByCategory.get(cat.id) || []).filter(
          matchesFilter
        );
        if (wordsInCat.length === 0) return null;

        const isOpen = !!openCats[cat.id];
        return (
          <div key={cat.id} className="list-cat">
            <button
              className="list-cat-header"
              style={{ borderLeftColor: cat.color }}
              onClick={() => toggleCat(cat.id)}
            >
              <span className="list-cat-arrow">{isOpen ? "▼" : "▶"}</span>
              <span className="list-cat-emoji">{cat.emoji}</span>
              <span className="list-cat-label">{cat.label}</span>
              <span className="list-cat-count">{wordsInCat.length}</span>
            </button>
            {isOpen && (
              <div className="list-cat-body">
                {showSubs && subs.length > 0 ? (
                  // ─── Mode AVEC sous-catégories ───
                  subs.map((sub) => {
                    const subWords = (
                      vocab.wordsBySubcategory.get(sub.id) || []
                    ).filter(matchesFilter);
                    if (subWords.length === 0) return null;
                    const isSubOpen = !!openSubs[sub.id];
                    return (
                      <div key={sub.id} className="list-sub">
                        <button
                          className="list-sub-header"
                          onClick={() => toggleSub(sub.id)}
                        >
                          <span className="list-sub-arrow">
                            {isSubOpen ? "▼" : "▶"}
                          </span>
                          <span>{sub.emoji}</span>
                          <span className="list-sub-label">{sub.label}</span>
                          <span className="list-sub-count">
                            {subWords.length}
                          </span>
                        </button>
                        {isSubOpen && (
                          <ul className="list-words">
                            {subWords.map((w) => (
                              <li
                                key={w.id}
                                className="list-word"
                                onClick={() => onSelectWord(w)}
                              >
                                <span className="list-word-text">{w.word}</span>
                                <span
                                  className={`level-btn l${w.niveau} small`}
                                >
                                  {w.niveau}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })
                ) : (
                  // ─── Mode SANS sous-catégories : tous les mots à plat, triés ───
                  <ul className="list-words flat">
                    {wordsInCat
                      .slice()
                      .sort((a, b) =>
                        a.word.localeCompare(b.word, "fr", {
                          sensitivity: "base",
                        })
                      )
                      .map((w) => (
                        <li
                          key={w.id}
                          className="list-word"
                          onClick={() => onSelectWord(w)}
                        >
                          <span className="list-word-text">{w.word}</span>
                          <span className={`level-btn l${w.niveau} small`}>
                            {w.niveau}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
