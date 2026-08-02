import { useEffect, useMemo, useState, useCallback } from "react";
import * as XLSX from "xlsx";

// ─────────────────────────────────────────────────────────────
//  STOCKAGE
//  Les données viennent du fichier /data.xlsx (placé dans public/).
//  Seuls les FAVORIS sont stockés en localStorage (personnels par
//  utilisateur).
// ─────────────────────────────────────────────────────────────
const LS_FAVS = "vocab_favorites_v2";
const DATA_URL = "/data.xlsx";

// Nombre maximum de mots reliés affichés sur une fiche : autant que la feuille
// « Liens » a de colonnes mot_N, pour qu'une ligne remplie s'affiche en entier.
const MAX_MOTS_RELIES = 10;

const slugify = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['"`’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const DEFAULT_EMOJI = "📁";

// Palette de secours quand la colonne "color" n'est pas remplie
const COLOR_PALETTE = [
  "#4a7fa5", "#c44536", "#7d8c4d", "#b8860b", "#5d4e75",
  "#2a7f7f", "#a0522d", "#6b8e23", "#8b6914", "#4682b4",
  "#cd5c5c", "#556b2f", "#9370db", "#3cb371", "#cd853f",
];
const colorForIndex = (i) => COLOR_PALETTE[i % COLOR_PALETTE.length];

// ─────────────────────────────────────────────────────────────
//  PARSING DU FICHIER XLSX
// ─────────────────────────────────────────────────────────────
function parseWorkbook(workbook) {
  const errors = [];
  const warnings = [];

  // ─── CATÉGORIES ───
  const wsCats = workbook.Sheets["Catégories"];
  const categories = [];
  if (wsCats) {
    const rows = XLSX.utils.sheet_to_json(wsCats, { defval: "" });
    // Trier par 'ordre' si présent
    const rowsWithIdx = rows.map((r, i) => ({ ...r, _rowIdx: i }));
    rowsWithIdx.sort((a, b) => {
      const oa = parseFloat(a.ordre);
      const ob = parseFloat(b.ordre);
      if (isNaN(oa) && isNaN(ob)) return a._rowIdx - b._rowIdx;
      if (isNaN(oa)) return 1;
      if (isNaN(ob)) return -1;
      return oa - ob;
    });
    rowsWithIdx.forEach((row, i) => {
      const label = (row.label || "").trim();
      if (!label) return;
      const id = (row.id || "").trim() || slugify(label);
      const colorFromXlsx = (row.color || "").trim();
      const urlFromXlsx = (row.url || "").trim();
      categories.push({
        id,
        label,
        emoji: (row.emoji || "").trim() || DEFAULT_EMOJI,
        color: colorFromXlsx || colorForIndex(i),
        cover: (row.cover || "").trim() || label,
        url: urlFromXlsx || null,
      });
    });
  } else {
    errors.push('Feuille "Catégories" manquante.');
  }

  // ─── SOUS-CATÉGORIES ───
  const wsSubs = workbook.Sheets["Sous-catégories"];
  const subcategories = [];
  if (wsSubs) {
    const rows = XLSX.utils.sheet_to_json(wsSubs, { defval: "" });
    rows.forEach((row, i) => {
      const label = (row.label || "").trim();
      const catRef = (row.categorie || "").trim();
      if (!label) return;
      // 'categorie' peut être un id (ex: "fanfare") ou un libellé (ex: "fanfare et instruments")
      const parent =
        categories.find((c) => c.id === catRef) ||
        categories.find((c) => slugify(c.label) === slugify(catRef));
      if (!parent) {
        warnings.push(`Sous-catégorie "${label}" : catégorie parent "${catRef}" introuvable.`);
        return;
      }
      const id = (row.id || "").trim() || slugify(label);
      const colorFromXlsx = (row.color || "").trim();
      const urlFromXlsx = (row.url || "").trim();
      subcategories.push({
        id,
        categoryId: parent.id,
        label,
        emoji: (row.emoji || "").trim() || DEFAULT_EMOJI,
        color: colorFromXlsx || colorForIndex(i + 7),
        cover: (row.cover || "").trim() || label,
        url: urlFromXlsx || null,
      });
    });
  } else {
    errors.push('Feuille "Sous-catégories" manquante.');
  }

  // ─── MOTS ───
  const wsWords = workbook.Sheets["Mots"];
  const words = [];
  if (wsWords) {
    const rows = XLSX.utils.sheet_to_json(wsWords, { defval: "" });
    rows.forEach((row) => {
      const wordLabel = (row.mot || "").trim();
      if (!wordLabel) return;
      const id = (row.id || "").trim() || slugify(wordLabel);

      // Le rattachement aux (sous-)catégories vient de la feuille
      // « Classement », et les tags de la feuille « Tags » : les colonnes
      // correspondantes ont été retirées de « Mots » (elles désignaient les
      // catégories par leur libellé, ce qui se trompait de cible dès que
      // deux libellés se ressemblaient).

      // Images : colonne principale "image_url" + colonnes optionnelles
      // "image_url_2", "image_url_3", … (dans l'ordre numérique).
      // Une cellule peut aussi contenir plusieurs URLs séparées par ; ou |.
      const imageUrls = Object.keys(row)
        .filter((k) => /^image_url(_\d+)?$/.test(k))
        .sort((a, b) => {
          const na = a === "image_url" ? 1 : parseInt(a.split("_").pop(), 10);
          const nb = b === "image_url" ? 1 : parseInt(b.split("_").pop(), 10);
          return na - nb;
        })
        .flatMap((k) =>
          (row[k] || "")
            .toString()
            .split(/[;|]/)
            .map((u) => u.trim())
        )
        .filter(Boolean);

      words.push({
        id,
        word: wordLabel,
        nature: (row.nature || "").toString().trim(),
        synonyms: [],
        phrases: [],
        facets: {},
        definition: (row.definition || "").trim(),
        astuce: (row.astuce || "").trim(),
        url: imageUrls[0] || null,
        urls: imageUrls,
        search: (row.image_recherche || "").trim() || wordLabel,
        tags: [],
        subcategoryIds: [],
        categoryIds: [],
      });
    });
  } else {
    errors.push('Feuille "Mots" manquante.');
  }

  // ─── LIENS ───
  // Format souple : chaque ligne contient un "mot pivot" en mot_1 et
  // autant de mots reliés que voulu en mot_2, mot_3, ... mot_N.
  // Les liens sont bidirectionnels donc l'ordre n'importe pas.
  // Les cellules contiennent l'identifiant du mot (colonne id de la feuille
  // Mots) : plusieurs mots peuvent partager le même libellé, l'identifiant
  // est donc le seul moyen de désigner l'entrée voulue sans ambiguïté.
  const byId = new Map(words.map((w) => [w.id.toLowerCase(), w]));
  const resolve = (value, rowIdx, colName) => {
    const key = value.toLowerCase();
    const byIdHit = byId.get(key);
    if (byIdHit) return byIdHit;
    // Tolérance : ancien format par libellé, encore accepté mais signalé car
    // il ne permet pas de distinguer deux mots au libellé identique.
    const matches = words.filter((w) => w.word.toLowerCase() === key);
    if (matches.length === 0) {
      warnings.push(`Liens ligne ${rowIdx + 2} : ${colName} "${value}" introuvable dans la feuille Mots.`);
      return null;
    }
    warnings.push(
      matches.length > 1
        ? `Liens ligne ${rowIdx + 2} : ${colName} "${value}" désigne ${matches.length} mots (${matches
            .map((w) => w.id)
            .join(", ")}) ; le lien pointe vers "${matches[0].id}". Utilisez l'identifiant voulu.`
        : `Liens ligne ${rowIdx + 2} : ${colName} "${value}" est un libellé ; utilisez l'identifiant "${matches[0].id}".`
    );
    return matches[0];
  };

  const wsConn = workbook.Sheets["Liens"];
  const connections = [];
  if (wsConn) {
    const rows = XLSX.utils.sheet_to_json(wsConn, { defval: "" });
    rows.forEach((row, rowIdx) => {
      const m1 = (row.mot_1 || "").toString().trim();
      if (!m1) return;
      const w1 = resolve(m1, rowIdx, "mot_1");
      if (!w1) return;
      // Trouver toutes les colonnes mot_N (N >= 2) dans l'ordre numérique
      const targetKeys = Object.keys(row)
        .filter((k) => /^mot_\d+$/.test(k) && k !== "mot_1")
        .sort((a, b) => {
          const na = parseInt(a.split("_")[1], 10);
          const nb = parseInt(b.split("_")[1], 10);
          return na - nb;
        });
      for (const key of targetKeys) {
        const m2 = (row[key] || "").toString().trim();
        if (!m2) continue;
        const w2 = resolve(m2, rowIdx, key);
        if (!w2) continue;
        if (w1.id === w2.id) continue; // pas de lien d'un mot avec lui-même
        connections.push({ from: w1.id, to: w2.id });
      }
    });
  }

  // ─── FEUILLES SATELLITES ───
  // Une valeur par mot vit dans « Mots » ; tout ce qui est multiple vit dans
  // sa propre feuille, reliée par l'identifiant du mot.
  const lignes = (nom) => {
    const ws = workbook.Sheets[nom];
    return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
  };
  const texte = (v) => (v == null ? "" : v.toString().trim());
  // Les feuilles satellites ont une ligne par mot et une colonne par valeur
  // (classement_1, lieu_2, exemple_3…). On lit donc toutes les colonnes dont
  // le nom commence par le préfixe voulu, dans l'ordre.
  const colonnes = (row, prefixe) =>
    Object.keys(row)
      .filter((k) => k === prefixe || new RegExp(`^${prefixe}_\\d+$`).test(k))
      .sort((a, b) => (parseInt(a.split("_").pop(), 10) || 0) - (parseInt(b.split("_").pop(), 10) || 0))
      .map((k) => texte(row[k]))
      .filter(Boolean);

  // Classement : appartenance aux (sous-)catégories, par identifiant
  const lignesClassement = lignes("Classement");
  if (lignesClassement.length > 0) {
    const subIds = new Set(subcategories.map((s) => s.id));
    const catIds = new Set(categories.map((c) => c.id));
    for (const w of words) {
      w.subcategoryIds = [];
      w.categoryIds = [];
    }
    lignesClassement.forEach((row, idx) => {
      const w = byId.get(texte(row.id_mot).toLowerCase());
      if (!w) return;
      for (const cible of colonnes(row, "classement")) {
        if (subIds.has(cible)) {
          if (!w.subcategoryIds.includes(cible)) w.subcategoryIds.push(cible);
        } else if (catIds.has(cible)) {
          if (!w.categoryIds.includes(cible)) w.categoryIds.push(cible);
        } else {
          warnings.push(`Classement ligne ${idx + 2} : « ${cible} » n'est ni une catégorie ni une sous-catégorie.`);
        }
      }
    });
  }

  // Tags : une colonne par famille (lieu_1, action_2…), la famille se lit
  // dans le nom de la colonne.
  for (const row of lignes("Tags")) {
    const w = byId.get(texte(row.id_mot).toLowerCase());
    if (!w) continue;
    for (const cle of Object.keys(row)) {
      if (cle === "id_mot" || cle.startsWith("mot")) continue;
      const tag = texte(row[cle]);
      if (!tag) continue;
      const famille = cle.replace(/_\d+$/, "");
      if (!w.facets[famille]) w.facets[famille] = [];
      if (!w.facets[famille].includes(tag)) w.facets[famille].push(tag);
      if (!w.tags.includes(tag)) w.tags.push(tag);
    }
  }

  // Synonymes : alias de recherche, jamais des entrées distinctes
  for (const row of lignes("Synonymes")) {
    const w = byId.get(texte(row.id_mot).toLowerCase());
    if (!w) continue;
    for (const s of colonnes(row, "synonyme")) {
      if (!w.synonyms.includes(s)) w.synonyms.push(s);
    }
  }

  // Phrases : les exemples d'abord, puis les expressions
  for (const row of lignes("Phrases")) {
    const w = byId.get(texte(row.id_mot).toLowerCase());
    if (!w) continue;
    for (const t of colonnes(row, "exemple")) w.phrases.push({ type: "exemple", texte: t });
    for (const t of colonnes(row, "expression")) w.phrases.push({ type: "expression", texte: t });
  }

  // Listes d'accès rapide
  const listesRef = lignes("Listes_ref")
    .filter((r) => texte(r.id_liste))
    .map((r) => ({
      id: texte(r.id_liste),
      label: texte(r.libellé) || texte(r.libelle) || texte(r.id_liste),
      icon: texte(r.icône) || texte(r.icone),
      order: Number(r.ordre) || 0,
      wordIds: [],
    }))
    .sort((a, b) => a.order - b.order);
  // Listes : une ligne par mot, une colonne par liste d'appartenance.
  const listeById = new Map(listesRef.map((l) => [l.id, l]));
  for (const row of lignes("Listes")) {
    const w = byId.get(texte(row.id_mot).toLowerCase());
    if (!w) continue;
    for (const idListe of colonnes(row, "liste")) {
      const l = listeById.get(idListe);
      if (l && !l.wordIds.includes(w.id)) l.wordIds.push(w.id);
    }
  }
  const lists = listesRef.filter((l) => l.wordIds.length > 0);

  // Références : familles de tags et natures, pour piloter l'interface
  const tagFamilies = [];
  const parFamille = new Map();
  for (const row of lignes("Tags_liste")) {
    const famille = texte(row.famille);
    const tag = texte(row.tag);
    if (!famille || !tag) continue;
    if (!parFamille.has(famille)) {
      const f = { id: famille, tags: [] };
      parFamille.set(famille, f);
      tagFamilies.push(f);
    }
    parFamille.get(famille).tags.push({
      id: tag,
      label: texte(row.libellé) || texte(row.libelle) || tag,
      order: Number(row.ordre) || 0,
      // « ancre » : le mot dont l'image illustre la tuile de cet axe.
      anchor: texte(row.ancre) || null,
    });
  }
  for (const f of tagFamilies) f.tags.sort((a, b) => a.order - b.order);

  const natures = lignes("Natures")
    .filter((r) => texte(r.nature))
    .map((r) => ({
      id: texte(r.nature),
      label: texte(r.libellé) || texte(r.libelle) || texte(r.nature),
      order: Number(r.ordre) || 0,
    }))
    .sort((a, b) => a.order - b.order);

  return {
    categories, subcategories, words, connections,
    lists, tagFamilies, natures,
    errors, warnings,
  };
}

// ─────────────────────────────────────────────────────────────
//  HOOK
// ─────────────────────────────────────────────────────────────
export function useVocab() {
  const [data, setData] = useState({
    categories: [],
    subcategories: [],
    words: [],
    connections: [],
    lists: [],
    tagFamilies: [],
    natures: [],
    loading: true,
    error: null,
  });

  // Favoris (seul stockage navigateur)
  const [favorites, setFavorites] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_FAVS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_FAVS, JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  // Charger data.xlsx au démarrage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(DATA_URL);
        if (!res.ok) throw new Error(`Erreur ${res.status} lors du chargement de data.xlsx`);
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
        const parsed = parseWorkbook(wb);
        if (cancelled) return;
        if (parsed.warnings.length > 0) {
          console.warn("[useVocab] Avertissements lors du parsing:", parsed.warnings);
        }
        setData({
          categories: parsed.categories,
          subcategories: parsed.subcategories,
          words: parsed.words,
          connections: parsed.connections,
          lists: parsed.lists || [],
          tagFamilies: parsed.tagFamilies || [],
          natures: parsed.natures || [],
          loading: false,
          error: parsed.errors.length > 0 ? parsed.errors.join(" / ") : null,
        });
      } catch (e) {
        console.error("[useVocab] Erreur chargement data.xlsx:", e);
        if (!cancelled) {
          setData((d) => ({ ...d, loading: false, error: e.message }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { categories, subcategories, words, connections } = data;

  // ──────── Index par id ────────
  const wordById = useMemo(() => {
    const m = new Map();
    for (const w of words) m.set(w.id, w);
    return m;
  }, [words]);

  const categoryById = useMemo(() => {
    const m = new Map();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const subcategoryById = useMemo(() => {
    const m = new Map();
    for (const s of subcategories) m.set(s.id, s);
    return m;
  }, [subcategories]);

  // Mots par sous-catégorie
  const wordsBySubcategory = useMemo(() => {
    const m = new Map();
    for (const w of words) {
      for (const sid of w.subcategoryIds || []) {
        if (!m.has(sid)) m.set(sid, []);
        m.get(sid).push(w);
      }
    }
    return m;
  }, [words]);

  // Mots par catégorie (directe ou via sous-catégorie)
  const wordsByCategory = useMemo(() => {
    const m = new Map();
    for (const w of words) {
      const catSet = new Set(w.categoryIds || []);
      for (const sid of w.subcategoryIds || []) {
        const sub = subcategoryById.get(sid);
        if (sub) catSet.add(sub.categoryId);
      }
      for (const cid of catSet) {
        if (!m.has(cid)) m.set(cid, []);
        m.get(cid).push(w);
      }
    }
    return m;
  }, [words, subcategoryById]);

  // Sous-catégories par catégorie
  const subcategoriesByCategory = useMemo(() => {
    const m = new Map();
    for (const s of subcategories) {
      if (!m.has(s.categoryId)) m.set(s.categoryId, []);
      m.get(s.categoryId).push(s);
    }
    return m;
  }, [subcategories]);

  // ──────── Connexions d'un mot ────────
  // Uniquement les liens explicites de la feuille « Liens » du data.xlsx.
  // Les mots de la même sous-catégorie ne sont PAS ajoutés automatiquement
  // (ils restent accessibles en remontant d'un niveau dans la navigation).
  // Le lien reste bidirectionnel : sans quoi 273 mots, dont l'église, le maçon
  // ou le fauteuil, n'afficheraient plus rien — personne n'a écrit de ligne
  // pour eux. Mais l'ordre n'est pas neutre : ce qui est écrit sur la ligne du
  // mot est un choix délibéré et passe donc en premier ; les liens venus
  // d'ailleurs complètent. La relation est réelle mais pas toujours
  // symétrique — l'inquiétude mène à la colère, l'inverse bien moins.
  const getConnections = useCallback(
    (wordId) => {
      const sortants = [];   // écrits sur la ligne de ce mot, dans l'ordre des colonnes
      const entrants = [];   // déclarés depuis la ligne d'un autre mot
      for (const c of connections) {
        if (c.from === wordId) sortants.push(c.to);
        else if (c.to === wordId) entrants.push(c.from);
      }
      const vus = new Set();
      const ordonnes = [];
      for (const id of [...sortants, ...entrants]) {
        if (id === wordId || vus.has(id)) continue;
        vus.add(id);
        ordonnes.push(id);
      }
      return ordonnes
        .map((id) => wordById.get(id))
        .filter(Boolean)
        .slice(0, MAX_MOTS_RELIES);
    },
    [connections, wordById]
  );

  // ──────── Tags (extraits dynamiquement) ────────
  const allTags = useMemo(() => {
    const s = new Set();
    for (const w of words) for (const t of w.tags || []) s.add(t);
    return Array.from(s).sort();
  }, [words]);

  // La colonne « niveau » a été retirée : elle ne servait plus de niveau mais
  // de liste d'accès rapide aux visages, ce que la feuille « Listes » fait
  // désormais mieux.

  // ──────── Favoris ────────
  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }, []);

  const resetFavorites = useCallback(() => {
    if (window.confirm("Effacer tous les favoris ?")) {
      setFavorites([]);
    }
  }, []);

  return {
    loading: data.loading,
    error: data.error,
    categories: data.categories,
    subcategories: data.subcategories,
    words: data.words,
    connections: data.connections,
    lists: data.lists,
    tagFamilies: data.tagFamilies,
    natures: data.natures,
    wordById,
    categoryById,
    subcategoryById,
    wordsBySubcategory,
    wordsByCategory,
    subcategoriesByCategory,
    allTags,
    getConnections,
    favorites,
    toggleFavorite,
    isFavorite: (id) => favorites.includes(id),
    resetFavorites,
  };
}
