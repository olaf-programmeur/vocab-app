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

// Palette pour assigner automatiquement des couleurs distinctes
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
      categories.push({
        id,
        label,
        emoji: (row.emoji || "").trim() || DEFAULT_EMOJI,
        color: colorForIndex(i),
        cover: (row.cover || "").trim() || label,
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
      const catLabel = (row.categorie || "").trim();
      if (!label) return;
      const parent = categories.find((c) => slugify(c.label) === slugify(catLabel));
      if (!parent) {
        warnings.push(`Sous-catégorie "${label}" : catégorie parent "${catLabel}" introuvable.`);
        return;
      }
      const id = (row.id || "").trim() || slugify(label);
      subcategories.push({
        id,
        categoryId: parent.id,
        label,
        emoji: (row.emoji || "").trim() || DEFAULT_EMOJI,
        color: colorForIndex(i + 7),
        cover: (row.cover || "").trim() || label,
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
      const subIds = [];
      for (const lbl of (row.sous_categories || "").split(";")) {
        const t = lbl.trim();
        if (!t) continue;
        const sub = subcategories.find((s) => slugify(s.label) === slugify(t));
        if (sub) subIds.push(sub.id);
      }
      const catIds = [];
      for (const lbl of (row.categories_directes || "").split(";")) {
        const t = lbl.trim();
        if (!t) continue;
        const cat = categories.find((c) => slugify(c.label) === slugify(t));
        if (cat) catIds.push(cat.id);
      }
      const niveau = (row.niveau || "A1").trim().toUpperCase();
      const tags = (row.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
      words.push({
        id: (row.id || "").trim() || slugify(wordLabel),
        word: wordLabel,
        niveau: ["A1", "A2", "B1", "B2"].includes(niveau) ? niveau : "A1",
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
        setData({
          categories: parsed.categories,
          subcategories: parsed.subcategories,
          words: parsed.words,
          connections: parsed.connections,
          loading: false,
          error: parsed.errors.length > 0 ? parsed.errors.join(" / ") : null,
        });
        if (parsed.warnings.length > 0) {
          console.warn("Avertissements :", parsed.warnings);
        }
      } catch (err) {
        if (cancelled) return;
        setData((d) => ({ ...d, loading: false, error: err.message }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const wordById = useMemo(() => {
    const m = new Map();
    for (const w of data.words) m.set(w.id, w);
    return m;
  }, [data.words]);

  const categoryById = useMemo(() => {
    const m = new Map();
    for (const c of data.categories) m.set(c.id, c);
    return m;
  }, [data.categories]);

  const subcategoryById = useMemo(() => {
    const m = new Map();
    for (const s of data.subcategories) m.set(s.id, s);
    return m;
  }, [data.subcategories]);

  const wordsBySubcategory = useMemo(() => {
    const m = new Map();
    for (const w of data.words) {
      for (const sid of w.subcategoryIds || []) {
        if (!m.has(sid)) m.set(sid, []);
        m.get(sid).push(w);
      }
    }
    return m;
  }, [data.words]);

  const wordsByCategory = useMemo(() => {
    const m = new Map();
    for (const w of data.words) {
      const catIds = new Set(w.categoryIds || []);
      for (const sid of w.subcategoryIds || []) {
        const sub = subcategoryById.get(sid);
        if (sub) catIds.add(sub.categoryId);
      }
      for (const cid of catIds) {
        if (!m.has(cid)) m.set(cid, []);
        if (!m.get(cid).find((x) => x.id === w.id)) m.get(cid).push(w);
      }
    }
    return m;
  }, [data.words, subcategoryById]);

  const subcategoriesByCategory = useMemo(() => {
    const m = new Map();
    for (const s of data.subcategories) {
      if (!m.has(s.categoryId)) m.set(s.categoryId, []);
      m.get(s.categoryId).push(s);
    }
    return m;
  }, [data.subcategories]);

  const getConnections = useCallback(
    (wordId) => {
      const direct = new Set();
      for (const c of data.connections) {
        if (c.from === wordId) direct.add(c.to);
        if (c.to === wordId) direct.add(c.from);
      }
      const w = wordById.get(wordId);
      if (w) {
        for (const sid of w.subcategoryIds || []) {
          for (const sib of wordsBySubcategory.get(sid) || []) {
            if (sib.id !== wordId) direct.add(sib.id);
          }
        }
      }
      return Array.from(direct)
        .map((id) => wordById.get(id))
        .filter(Boolean)
        .slice(0, 8);
    },
    [data.connections, wordById, wordsBySubcategory]
  );

  const allTags = useMemo(() => {
    const s = new Set();
    for (const w of data.words) for (const t of w.tags || []) s.add(t);
    return Array.from(s).sort();
  }, [data.words]);

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => {
      return prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
    });
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
