import { useState, useEffect, useCallback } from "react";
import WordImage from "./WordImage.jsx";

export default function Quiz({ wordsPool, onClose }) {
  const [current, setCurrent] = useState(null);
  const [options, setOptions] = useState([]);
  const [answer, setAnswer] = useState(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const newQuestion = useCallback(() => {
    const eligible = wordsPool.filter((w) => w.url || w.search);
    if (eligible.length < 4) {
      setCurrent(null);
      return;
    }
    const idx = Math.floor(Math.random() * eligible.length);
    const correct = eligible[idx];
    const others = eligible.filter((_, i) => i !== idx);
    const shuffled = [...others]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const opts = [...shuffled, correct].sort(() => Math.random() - 0.5);
    setCurrent(correct);
    setOptions(opts);
    setAnswer(null);
  }, [wordsPool]);

  useEffect(() => {
    newQuestion();
  }, [newQuestion]);

  if (!current) {
    return (
      <div className="detail-overlay" onClick={onClose}>
        <div className="detail-card" onClick={(e) => e.stopPropagation()}>
          <button className="detail-close" onClick={onClose}>×</button>
          <p>Pas assez de mots avec image dans cette sélection (min. 4).</p>
        </div>
      </div>
    );
  }

  const handleAnswer = (opt) => {
    if (answer !== null) return;
    setAnswer(opt.id);
    setScore((s) => ({
      correct: s.correct + (opt.id === current.id ? 1 : 0),
      total: s.total + 1,
    }));
  };

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-card quiz-card" onClick={(e) => e.stopPropagation()}>
        <button className="detail-close" onClick={onClose}>×</button>
        <h2>🎯 Quiz</h2>
        <div className="quiz-score">
          Score : <strong>{score.correct} / {score.total}</strong>
        </div>
        <div className="quiz-image">
          <WordImage url={current.url} search={current.search} size={260} />
        </div>
        <div className="quiz-question">Quel est ce mot ?</div>
        <div className="quiz-options">
          {options.map((opt) => {
            let cls = "quiz-option";
            if (answer !== null) {
              if (opt.id === current.id) cls += " correct";
              else if (opt.id === answer) cls += " wrong";
            }
            return (
              <button
                key={opt.id}
                className={cls}
                onClick={() => handleAnswer(opt)}
                disabled={answer !== null}
              >
                {opt.word}
              </button>
            );
          })}
        </div>
        {answer !== null && (
          <div className="quiz-feedback">
            <div
              className={
                answer === current.id ? "quiz-result-ok" : "quiz-result-ko"
              }
            >
              {answer === current.id
                ? "✅ Bravo !"
                : `❌ C'était : ${current.word}`}
            </div>
            <div className="quiz-actions">
              <button className="btn-primary" onClick={newQuestion}>
                Question suivante →
              </button>
              <button className="btn-secondary" onClick={onClose}>
                Quitter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
