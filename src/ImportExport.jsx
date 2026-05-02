import { useState, useRef } from "react";
import * as XLSX from "xlsx";

// Mêmes helpers que dans useVocab
const slugify = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['"`’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

function findByLabel(label, list) {
  if (!label) return null;
  const norm = slugify(label);
  return list.find((x) => slugify(x.label) === norm) || null;
}

function findWordByLabel(label, words) {
  if (!label) return null;
  const norm = label.trim().toLowerCase();
  return words.find((w) => w.word.toLowerCase() === norm) || null;
}

// ─────────────────────────────────────────────────────────────
//  ANALYSE COMPARAISON
//  Compare le fichier choisi avec les données actuellement chargées.
// ─────────────────────────────────────────────────────────────
function analyzeFile(workbook, vocab) {
  const result = {
    addedCategories: [],
    editedCategories: [],
    deletedCategories: [],
    reorderedCategories: false,
    addedSubcategories: [],
    editedSubcategories: [],
    deletedSubcategories: [],
    addedWords: [],
    editedWords: [],
    deletedWords: [],
    addedConnections: [],
    deletedConnections: [],
    errors: [],
    warnings: [],
  };

  // Pour la comparaison on s'appuie sur les données déjà chargées
  const existingCats = vocab.categories;
  const existingSubs = vocab.subcategories;
  const existingWords = vocab.words;
  const existingConns = vocab.connections;

  // ─── CATÉGORIES ───
  const wsCats = workbook.Sheets["Catégories"];
  const seenCatIds = new Set();
  const catsAfter = [];
  const orderedCatIds = [];

  if (wsCats) {
    const rows = XLSX.utils.sheet_to_json(wsCats, { defval: "" });
    const sorted = rows.map((r, i) => ({ ...r, _i: i })).sort((a, b) => {
      const oa = parseFloat(a.ordre);
      const ob = parseFloat(b.ordre);
      if (isNaN(oa) && isNaN(ob)) return a._i - b._i;
      if (isNaN(oa)) return 1;
      if (isNaN(ob)) return -1;
      return oa - ob;
    });
    sorted.forEach((row) => {
      const label = (row.label || "").trim();
      if (!label) return;
      const id = (row.id || "").trim() || slugify(label);
      seenCatIds.add(id);
      orderedCatIds.push(id);
      const imported = {
        id,
        label,
        emoji: (row.emoji || "").trim() || "📁",
        cover: (row.cover || "").trim() || label,
      };
      const existing = vocab.categoryById.get(id);
      if (!existing) {
        result.addedCategories.push(imported);
        catsAfter.push(imported);
      } else {
        catsAfter.push({ ...existing, ...imported });
        const changes = catChanges(existing, imported);
        if (changes.length > 0) {
          result.editedCategories.push({ category: imported, changes });
        }
      }
    });
    for (const c of existingCats) {
      if (!seenCatIds.has(c.id)) result.deletedCategories.push(c);
    }
    const currentOrder = existingCats.map((c) => c.id);
    if (
      currentOrder.length !== orderedCatIds.length ||
      currentOrder.some((id, i) => id !== orderedCatIds[i])
    ) {
      result.reorderedCategories = true;
    }
  } else {
    result.errors.push('Feuille "Catégories" absente.');
    catsAfter.push(...existingCats);
  }

  // ─── SOUS-CATÉGORIES ───
  const wsSubs = workbook.Sheets["Sous-catégories"];
  const seenSubIds = new Set();
  const subsAfter = [];

  if (wsSubs) {
    const rows = XLSX.utils.sheet_to_json(wsSubs, { defval: "" });
    rows.forEach((row, idx) => {
      const lineNum = idx + 2;
      const label = (row.label || "").trim();
      const catLabel = (row.categorie || "").trim();
      if (!label) return;
      if (!catLabel) {
        result.errors.push(`Sous-catégories ligne ${lineNum} ("${label}") : colonne "categorie" vide.`);
        return;
      }
      const parent = findByLabel(catLabel, catsAfter);
      if (!parent) {
        result.errors.push(`Sous-catégories ligne ${lineNum} ("${label}") : catégorie parent "${catLabel}" inconnue.`);
        return;
      }
      const id = (row.id || "").trim() || slugify(label);
      seenSubIds.add(id);
      const imported = {
        id,
        categoryId: parent.id,
        label,
        emoji: (row.emoji || "").trim() || "📁",
        cover: (row.cover || "").trim() || label,
      };
      const existing = vocab.subcategoryById.get(id);
      if (!existing) {
        result.addedSubcategories.push(imported);
        subsAfter.push(imported);
      } else {
        subsAfter.push({ ...existing, ...imported });
        const changes = subChanges(existing, imported);
        if (changes.length > 0) {
          result.editedSubcategories.push({ subcategory: imported, changes });
        }
      }
    });
    for (const s of existingSubs) {
      if (!seenSubIds.has(s.id)) result.deletedSubcategories.push(s);
    }
  } else {
    result.errors.push('Feuille "Sous-catégories" absente.');
    subsAfter.push(...existingSubs);
  }

  // ─── MOTS ───
  const wsWords = workbook.Sheets["Mots"];
  const seenWordIds = new Set();
  const wordsAfter = [];

  if (wsWords) {
    const rows = XLSX.utils.sheet_to_json(wsWords, { defval: "" });
    rows.forEach((row, idx) => {
      const lineNum = idx + 2;
      const wordLabel = (row.mot || "").trim();
      if (!wordLabel) return;

      const niveau = (row.niveau || "A1").trim().toUpperCase();
      if (!["A1", "A2", "B1", "B2"].includes(niveau)) {
        result.errors.push(`Mots ligne ${lineNum} ("${wordLabel}") : niveau "${niveau}" invalide.`);
      }

      const subIds = [];
      for (const lbl of (row.sous_categories || "").split(";")) {
        const t = lbl.trim();
        if (!t) continue;
        const sub = findByLabel(t, subsAfter);
        if (sub) subIds.push(sub.id);
        else result.errors.push(`Mots ligne ${lineNum} ("${wordLabel}") : sous-catégorie "${t}" inconnue.`);
      }
      const catIds = [];
      for (const lbl of (row.categories_directes || "").split(";")) {
        const t = lbl.trim();
        if (!t) continue;
        const cat = findByLabel(t, catsAfter);
        if (cat) catIds.push(cat.id);
        else result.errors.push(`Mots ligne ${lineNum} ("${wordLabel}") : catégorie "${t}" inconnue.`);
      }
      if (subIds.length === 0 && catIds.length === 0) {
        result.errors.push(`Mots ligne ${lineNum} ("${wordLabel}") : aucune sous-catégorie ni catégorie valide.`);
      }

      const tags = (row.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
      const id = (row.id || "").trim() || slugify(wordLabel);
      const imported = {
        id,
        word: wordLabel,
        niveau,
        definition: (row.definition || "").trim(),
        exemple: (row.exemple || "").trim(),
        astuce: (row.astuce || "").trim(),
        url: (row.image_url || "").trim() || null,
        search: (row.image_recherche || "").trim() || wordLabel,
        tags,
        subcategoryIds: subIds,
        categoryIds: catIds,
      };
      seenWordIds.add(id);
      const existing = vocab.wordById.get(id);
      if (!existing) {
        result.addedWords.push(imported);
        wordsAfter.push(imported);
      } else {
        wordsAfter.push({ ...existing, ...imported });
        const changes = wordChanges(existing, imported);
        if (changes.length > 0) {
          result.editedWords.push({ word: imported, changes });
        }
      }
    });
    for (const w of existingWords) {
      if (!seenWordIds.has(w.id)) result.deletedWords.push(w);
    }
  } else {
    result.errors.push('Feuille "Mots" absente.');
    wordsAfter.push(...existingWords);
  }

  // ─── VALIDATION CASCADE ───
  for (const sub of result.deletedSubcategories) {
    const usedBy = wordsAfter.filter((w) => (w.subcategoryIds || []).includes(sub.id));
    if (usedBy.length > 0) {
      result.errors.push(
        `Suppression refusée : la sous-catégorie "${sub.label}" est encore utilisée par ${usedBy.length} mot(s) (${usedBy.slice(0, 3).map((w) => w.word).join(", ")}${usedBy.length > 3 ? "…" : ""}).`
      );
    }
  }
  for (const cat of result.deletedCategories) {
    const orphanSubs = subsAfter.filter((s) => s.categoryId === cat.id);
    if (orphanSubs.length > 0) {
      result.errors.push(
        `Suppression refusée : la catégorie "${cat.label}" contient encore ${orphanSubs.length} sous-catégorie(s).`
      );
    }
    const directWords = wordsAfter.filter((w) => (w.categoryIds || []).includes(cat.id));
    if (directWords.length > 0) {
      result.errors.push(
        `Suppression refusée : la catégorie "${cat.label}" est encore utilisée par ${directWords.length} mot(s).`
      );
    }
  }

  // ─── LIENS ───
  const wsConn = workbook.Sheets["Liens"];
  if (wsConn) {
    const rows = XLSX.utils.sheet_to_json(wsConn, { defval: "" });
    const seen = new Set();
    const importedConns = [];
    rows.forEach((row, idx) => {
      const lineNum = idx + 2;
      const m1 = (row.mot_1 || "").trim();
      const m2 = (row.mot_2 || "").trim();
      if (!m1 && !m2) return;
      if (!m1 || !m2) {
        result.errors.push(`Liens ligne ${lineNum} : un des deux mots est vide.`);
        return;
      }
      const w1 = findWordByLabel(m1, wordsAfter);
      const w2 = findWordByLabel(m2, wordsAfter);
      if (!w1) {
        result.errors.push(`Liens ligne ${lineNum} : mot "${m1}" introuvable.`);
        return;
      }
      if (!w2) {
        result.errors.push(`Liens ligne ${lineNum} : mot "${m2}" introuvable.`);
        return;
      }
      const key = [w1.id, w2.id].sort().join("→");
      if (seen.has(key)) return;
      seen.add(key);
      importedConns.push({ from: w1.id, to: w2.id, _key: key });
    });
    const existingKeys = new Set(existingConns.map((c) => [c.from, c.to].sort().join("→")));
    for (const c of importedConns) {
      if (!existingKeys.has(c._key)) result.addedConnections.push({ from: c.from, to: c.to });
    }
    for (const c of existingConns) {
      const key = [c.from, c.to].sort().join("→");
      if (!seen.has(key)) result.deletedConnections.push(c);
    }
  }

  return result;
}

function catChanges(existing, imported) {
  const changes = [];
  for (const f of ["label", "emoji", "cover"]) {
    if ((existing[f] || "") !== (imported[f] || "")) changes.push(f);
  }
  return changes;
}

function subChanges(existing, imported) {
  const changes = [];
  for (const f of ["label", "emoji", "cover", "categoryId"]) {
    if ((existing[f] || "") !== (imported[f] || "")) changes.push(f);
  }
  return changes;
}

function wordChanges(existing, imported) {
  const changes = [];
  for (const f of ["word", "niveau", "definition", "exemple", "astuce", "url", "search"]) {
    if ((existing[f] || "") !== (imported[f] || "")) changes.push(f);
  }
  const arrEq = (a, b) => {
    const sa = [...(a || [])].sort();
    const sb = [...(b || [])].sort();
    return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
  };
  if (!arrEq(existing.tags, imported.tags)) changes.push("tags");
  if (!arrEq(existing.subcategoryIds, imported.subcategoryIds)) changes.push("subcategoryIds");
  if (!arrEq(existing.categoryIds, imported.categoryIds)) changes.push("categoryIds");
  return changes;
}

// ─────────────────────────────────────────────────────────────
//  COMPOSANT
// ─────────────────────────────────────────────────────────────
export default function ImportExport({ vocab, onClose }) {
  const fileInputRef = useRef(null);
  const [analysis, setAnalysis] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const result = analyzeFile(wb, vocab);
        setAnalysis(result);
      } catch (err) {
        alert("Impossible de lire le fichier : " + err.message);
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      alert("Erreur de lecture.");
      setIsProcessing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const totalChanges =
    analysis &&
    analysis.addedCategories.length +
      analysis.editedCategories.length +
      analysis.deletedCategories.length +
      analysis.addedSubcategories.length +
      analysis.editedSubcategories.length +
      analysis.deletedSubcategories.length +
      analysis.addedWords.length +
      analysis.editedWords.length +
      analysis.deletedWords.length +
      analysis.addedConnections.length +
      analysis.deletedConnections.length +
      (analysis.reorderedCategories ? 1 : 0);

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-card form-card" onClick={(e) => e.stopPropagation()}>
        <button className="detail-close" onClick={onClose} aria-label="Fermer">×</button>
        <h2>📊 Comparer un fichier Excel</h2>

        {!analysis && (
          <>
            <div className="detail-section">
              <p>
                Cette page te permet de <strong>prévisualiser</strong> les changements
                apportés par un nouveau fichier Excel, sans l'appliquer.
              </p>
              <div className="form-hint" style={{ marginTop: 8 }}>
                💡 <strong>Workflow recommandé :</strong>
                <ol style={{ marginTop: 4, paddingLeft: 18 }}>
                  <li>Télécharge le fichier <code>data.xlsx</code> depuis ton projet CodeSandbox.</li>
                  <li>Modifie-le dans Excel sur ton ordinateur.</li>
                  <li>Charge le fichier modifié ici pour vérifier les changements.</li>
                  <li>Si tout est OK, va dans CodeSandbox et remplace <code>public/data.xlsx</code> par ta nouvelle version.</li>
                  <li>Rafraîchis la page : tout le monde voit les changements.</li>
                </ol>
              </div>
              <div style={{ marginTop: 14 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFilePick}
                  style={{ display: "none" }}
                />
                <button
                  className="btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  {isProcessing ? "Analyse…" : "📂 Choisir un fichier à comparer"}
                </button>
              </div>
            </div>
          </>
        )}

        {analysis && (
          <div className="detail-section">
            <h3>📋 Différences détectées</h3>

            {analysis.errors.length > 0 && (
              <div className="import-errors">
                <strong>⚠️ {analysis.errors.length} erreur(s) — à corriger avant remplacement :</strong>
                <ul>
                  {analysis.errors.slice(0, 30).map((e, i) => (<li key={i}>{e}</li>))}
                  {analysis.errors.length > 30 && (<li>… et {analysis.errors.length - 30} autres</li>)}
                </ul>
              </div>
            )}

            {totalChanges === 0 && analysis.errors.length === 0 ? (
              <div className="import-warnings">
                ✅ Aucune différence avec le fichier actuel.
              </div>
            ) : (
              <>
                <div className="import-block">
                  <strong>Catégories</strong>
                  <div className="import-summary">
                    <div className="import-stat"><span className="num add">+{analysis.addedCategories.length}</span><span>ajout(s)</span></div>
                    <div className="import-stat"><span className="num edit">~{analysis.editedCategories.length}</span><span>modif(s)</span></div>
                    <div className="import-stat"><span className="num del">−{analysis.deletedCategories.length}</span><span>suppr.</span></div>
                    {analysis.reorderedCategories && (<div className="import-stat"><span className="num edit">↕</span><span>ordre changé</span></div>)}
                  </div>
                </div>

                <div className="import-block">
                  <strong>Sous-catégories</strong>
                  <div className="import-summary">
                    <div className="import-stat"><span className="num add">+{analysis.addedSubcategories.length}</span><span>ajout(s)</span></div>
                    <div className="import-stat"><span className="num edit">~{analysis.editedSubcategories.length}</span><span>modif(s)</span></div>
                    <div className="import-stat"><span className="num del">−{analysis.deletedSubcategories.length}</span><span>suppr.</span></div>
                  </div>
                </div>

                <div className="import-block">
                  <strong>Mots</strong>
                  <div className="import-summary">
                    <div className="import-stat"><span className="num add">+{analysis.addedWords.length}</span><span>ajout(s)</span></div>
                    <div className="import-stat"><span className="num edit">~{analysis.editedWords.length}</span><span>modif(s)</span></div>
                    <div className="import-stat"><span className="num del">−{analysis.deletedWords.length}</span><span>suppr.</span></div>
                  </div>
                </div>

                <div className="import-block">
                  <strong>Liens</strong>
                  <div className="import-summary">
                    <div className="import-stat"><span className="num add">+{analysis.addedConnections.length}</span><span>ajout(s)</span></div>
                    <div className="import-stat"><span className="num del">−{analysis.deletedConnections.length}</span><span>suppr.</span></div>
                  </div>
                </div>

                {analysis.addedWords.length > 0 && (
                  <details className="import-details">
                    <summary>Voir les nouveaux mots ({analysis.addedWords.length})</summary>
                    <ul>
                      {analysis.addedWords.slice(0, 50).map((w) => (
                        <li key={w.id}><strong>{w.word}</strong> ({w.niveau})</li>
                      ))}
                      {analysis.addedWords.length > 50 && (<li>… et {analysis.addedWords.length - 50} autres</li>)}
                    </ul>
                  </details>
                )}

                {analysis.editedWords.length > 0 && (
                  <details className="import-details">
                    <summary>Voir les modifications de mots ({analysis.editedWords.length})</summary>
                    <ul>
                      {analysis.editedWords.slice(0, 50).map((e) => (
                        <li key={e.word.id}><strong>{e.word.word}</strong> — {e.changes.join(", ")}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}

            {totalChanges > 0 && analysis.errors.length === 0 && (
              <div className="import-warnings" style={{ marginTop: 14 }}>
                ✅ Le fichier est valide. Pour appliquer ces changements, remplace
                <code> public/data.xlsx</code> dans CodeSandbox par ton fichier modifié.
              </div>
            )}

            <div className="form-actions" style={{ marginTop: 14 }}>
              <button className="btn-secondary" onClick={() => setAnalysis(null)}>
                Choisir un autre fichier
              </button>
              <button className="btn-primary" onClick={onClose}>
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
