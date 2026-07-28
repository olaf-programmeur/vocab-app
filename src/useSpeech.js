import { useCallback, useEffect, useState } from "react";

// Synthèse vocale du navigateur : aucune dépendance, aucun compte, et la
// lecture fonctionne hors ligne une fois les voix installées par le système.
//
// En aphasie, la compréhension orale résiste souvent mieux que la lecture, et
// entendre le mot suffit parfois à débloquer sa production. Le débit est donc
// volontairement plus lent que la valeur par défaut.
const DEBIT = 0.85;

// Les libellés contiennent des séparateurs qui se lisent mal : « chaud ↔ froid »
// doit s'entendre « chaud, froid », pas « chaud flèche froid ».
export function pourVoix(texte) {
  return (texte || "")
    .replace(/↔/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/\s*\+\+\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function useSpeech() {
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  const [voix, setVoix] = useState(null);

  useEffect(() => {
    if (!supported) return;
    // Les voix arrivent de façon asynchrone : sans cet écouteur, la première
    // lecture se ferait avec la voix par défaut du système, souvent anglaise.
    const choisir = () => {
      const toutes = window.speechSynthesis.getVoices() || [];
      const fr = toutes.filter(
        (v) => v.lang && v.lang.toLowerCase().startsWith("fr")
      );
      if (fr.length === 0) return;
      const suisse = fr.find((v) => v.lang.toLowerCase() === "fr-ch");
      setVoix(suisse || fr[0]);
    };
    choisir();
    window.speechSynthesis.addEventListener("voiceschanged", choisir);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", choisir);
  }, [supported]);

  const lire = useCallback(
    (texte) => {
      if (!supported) return;
      const t = pourVoix(texte);
      if (!t) return;
      // On coupe la lecture en cours : deux voix simultanées seraient
      // incompréhensibles, et l'appui répété est un geste fréquent.
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      if (voix) u.voice = voix;
      u.lang = voix ? voix.lang : "fr-FR";
      u.rate = DEBIT;
      window.speechSynthesis.speak(u);
    },
    [supported, voix]
  );

  const stopper = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { supported, lire, stopper, voix };
}
