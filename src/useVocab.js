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

      // Sous-catégories (séparateur ; ou ,)
      const subRaw = (row.sous_categories || "").toString();
      const subIds = subRaw
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((label) => {
          const sub = subcategories.find(
            (s) => slugify(s.label) === slugify(label) || s.id === label
          );
          if (!sub) {
            warnings.push(`Mot "${wordLabel}" : sous-catégorie "${label}" introuvable.`);
            return null;
          }
          return sub.id;
        })
        .filter(Boolean);

      // Catégories directes
      const catRaw = (row.categories_directes || "").toString();
      const catIds = catRaw
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((label) => {
          const cat = categories.find(
            (c) => slugify(c.label) === slugify(label) || c.id === label
          );
          if (!cat) {
            warnings.push(`Mot "${wordLabel}" : catégorie "${label}" introuvable.`);
            return null;
          }
          return cat.id;
        })
        .filter(Boolean);

      // Tags
      const tagRaw = (row.tags || "").toString();
      const tags = tagRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      words.push({
        id,
        word: wordLabel,
        niveau: (row.niveau || "").trim() || "A1",
        definition: (row.definition || "").trim(),
        exemple: (row.exemple || "").trim(),
        astuce: (row.astuce || "").trim(),
        url: (row.image_url || "").trim() || null,
        search: (row.image_recherche || "").trim() || wordLabel,
        tags,
        subcategoryIds: subIds,
        categoryIds: catIds,
      });
    });
  } else {
    errors.push('Feuille "Mots" manquante.');
  }

  // ─── LIENS ───
  const wsConn = workbook.Sheets["Liens"];
  const connections = [];
  if (wsConn) {
    const rows = XLSX.utils.sheet_to_json(wsConn, { defval: "" });
    rows.forEach((row) => {
      const m1 = (row.mot_1 || "").trim();
      const m2 = (row.mot_2 || "").trim();
      if (!m1 || !m2) return;
      const w1 = words.find((w) => w.word.toLowerCase() === m1.toLowerCase());
      const w2 = words.find((w) => w.word.toLowerCase() === m2.toLowerCase());
      if (w1 && w2) {
        connections.push({ from: w1.id, to: w2.id });
      }
    });
  }

  return { categories, subcategories, words, connections, errors, warnings };
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
  const getConnections = useCallback(
    (wordId) => {
      const direct = new Set();
      for (const c of connections) {
        if (c.from === wordId) direct.add(c.to);
        if (c.to === wordId) direct.add(c.from);
      }
      return Array.from(direct)
        .map((id) => wordById.get(id))
        .filter(Boolean)
        .slice(0, 8);
    },
    [connections, wordById]
  );

  // ──────── Tags (extraits dynamiquement) ────────
  const allTags = useMemo(() => {
    const s = new Set();
    for (const w of words) for (const t of w.tags || []) s.add(t);
    return Array.from(s).sort();
  }, [words]);

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
