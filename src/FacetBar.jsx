import { useMemo } from "react";

// Intitulés des axes, formulés comme des questions que la personne peut se poser.
const TITRES = {
  nature: "Quelle sorte de mot ?",
  sorte: "C'est une sorte de…",
  partie_de: "C'est une partie de…",
  lieu: "Où ça se trouve ?",
  action: "À quoi ça sert ?",
  mesure: "Ça mesure…",
  qualite: "Ça parle de…",
  personne: "Quelle personne ?",
  ressenti: "Agréable ou non ?",
};

// Ordre d'apparition : du plus général au plus fin.
const ORDRE = ["nature", "sorte", "partie_de", "lieu", "action", "mesure",
               "qualite", "personne", "ressenti"];

export function valeursDuMot(word, familyId) {
  if (familyId === "nature") return word.nature ? [word.nature] : [];
  return (word.facets && word.facets[familyId]) || [];
}

export default function FacetBar({ familles, pool, actifs, onToggle, wordById }) {
  // Pour chaque axe, on compte les mots par valeur en tenant compte des
  // autres axes déjà choisis : les nombres affichés sont donc toujours ceux
  // qu'on obtiendra réellement en cliquant.
  const axes = useMemo(() => {
    const out = [];
    for (const fam of familles) {
      const autres = Object.entries(actifs).filter(([k]) => k !== fam.id);
      const sousEnsemble = pool.filter((w) =>
        autres.every(([k, v]) => valeursDuMot(w, k).includes(v))
      );
      const compte = new Map();
      for (const w of sousEnsemble) {
        for (const v of valeursDuMot(w, fam.id)) {
          compte.set(v, (compte.get(v) || 0) + 1);
        }
      }
      const valeurs = fam.tags
        .map((t) => ({ ...t, n: compte.get(t.id) || 0 }))
        .filter((t) => t.n > 0 || actifs[fam.id] === t.id);
      // Règle : un axe ne s'affiche que s'il découpe vraiment ce qui est là.
      if (valeurs.length >= 2 || actifs[fam.id]) {
        out.push({ ...fam, valeurs });
      }
    }
    return out;
  }, [familles, pool, actifs]);

  if (axes.length === 0) return null;

  return (
    <div className="facet-bar">
      {axes.map((axe) => (
        <div key={axe.id} className="facet-row">
          <div className="facet-title">{TITRES[axe.id] || axe.id}</div>
          <div className="facet-values">
            {axe.valeurs.map((v) => {
              const actif = actifs[axe.id] === v.id;
              // Une image vaut mieux qu'un mot : si un mot du vocabulaire
              // incarne cette valeur, on montre sa photo sur la tuile.
              const ancre = v.anchor && wordById ? wordById.get(v.anchor) : null;
              const vignette = ancre && ancre.urls && ancre.urls[0];
              return (
                <button
                  key={v.id}
                  className={`facet-chip${actif ? " active" : ""}`}
                  onClick={() => onToggle(axe.id, v.id)}
                  aria-pressed={actif}
                >
                  {vignette && (
                    <img className="facet-vignette" src={vignette} alt="" />
                  )}
                  {v.label}
                  <span className="facet-count">{v.n}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export { ORDRE, TITRES };
