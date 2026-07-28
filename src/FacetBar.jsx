import { useMemo, useState } from "react";

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

// Une seule valeur peut être choisie par axe : afficher les neuf questions à la
// fois n'apporte donc rien et sature l'écran. On n'en montre qu'une, la
// suivante apparaissant une fois la réponse donnée. Les réponses déjà données
// restent visibles et modifiables, et « Une autre question » permet de sortir
// de l'ordre proposé — le chemin est suggéré, jamais imposé.
export default function FacetBar({ familles, pool, actifs, onToggle, wordById }) {
  const [toutVoir, setToutVoir] = useState(false);

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
      // Un axe ne compte que s'il découpe vraiment ce qui est là.
      if (valeurs.length >= 2 || actifs[fam.id]) {
        out.push({ ...fam, valeurs });
      }
    }
    return out;
  }, [familles, pool, actifs]);

  if (axes.length === 0) return null;

  const repondus = axes.filter((a) => actifs[a.id]);
  const restants = axes.filter((a) => !actifs[a.id]);
  const courants = toutVoir ? restants : restants.slice(0, 1);

  const vignetteDe = (v) => {
    const ancre = v.anchor && wordById ? wordById.get(v.anchor) : null;
    return ancre && ancre.urls && ancre.urls[0];
  };

  return (
    <div className="facet-bar">
      {repondus.length > 0 && (
        <div className="facet-repondus">
          {repondus.map((axe) => {
            const v = axe.valeurs.find((x) => x.id === actifs[axe.id]);
            return (
              <button
                key={axe.id}
                className="facet-repondu"
                onClick={() => onToggle(axe.id, actifs[axe.id])}
                title="Enlever ce choix"
              >
                <span className="facet-repondu-q">{TITRES[axe.id] || axe.id}</span>
                <span className="facet-repondu-v">{v ? v.label : actifs[axe.id]}</span>
                <span aria-hidden="true">×</span>
              </button>
            );
          })}
        </div>
      )}

      {courants.map((axe) => (
        <div key={axe.id} className="facet-row">
          <div className="facet-question">{TITRES[axe.id] || axe.id}</div>
          <div className="facet-values">
            {axe.valeurs.map((v) => {
              const vignette = vignetteDe(v);
              return (
                <button
                  key={v.id}
                  className="facet-chip"
                  onClick={() => {
                    onToggle(axe.id, v.id);
                    setToutVoir(false);
                  }}
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

      {restants.length > 1 && (
        <button
          className="facet-autre"
          onClick={() => setToutVoir(!toutVoir)}
        >
          {toutVoir
            ? "◂ Revenir à une seule question"
            : `▸ Une autre question (${restants.length - 1})`}
        </button>
      )}
    </div>
  );
}

export { ORDRE, TITRES };
