import { useState, useRef } from "react";
import WordImage from "./WordImage.jsx";

// Galerie d'images d'un mot : on balaie de gauche à droite (doigt sur
// tablette/téléphone, ou glisser à la souris) pour changer d'image.
// - 0 ou 1 image  → comportement identique à avant (avec repli recherche).
// - 2 images ou + → carrousel avec points indicateurs et flèches.
export default function WordGallery({ urls = [], search, size = 220 }) {
  const list = (urls || []).filter(Boolean);

  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const startX = useRef(null);

  // Un seul visuel : on délègue à WordImage (gère le repli recherche Pexels).
  if (list.length <= 1) {
    return <WordImage url={list[0]} search={search} size={size} />;
  }

  const clamp = (i) => Math.max(0, Math.min(list.length - 1, i));
  const go = (i) => setIndex(clamp(i));

  const onDown = (e) => {
    startX.current = e.clientX;
    setDrag(0);
  };
  const onMove = (e) => {
    if (startX.current === null) return;
    setDrag(e.clientX - startX.current);
  };
  const onUp = () => {
    if (startX.current === null) return;
    const threshold = size * 0.2; // ~20 % de la largeur suffit à valider
    if (drag <= -threshold) go(index + 1);
    else if (drag >= threshold) go(index - 1);
    setDrag(0);
    startX.current = null;
  };

  const dragging = startX.current !== null;

  return (
    <div className="gallery" style={{ width: size }}>
      <div
        className="gallery-viewport"
        style={{ width: size, height: size }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        <div
          className="gallery-track"
          style={{
            transform: `translateX(calc(${-index * 100}% + ${drag}px))`,
            transition: dragging ? "none" : "transform 0.25s ease",
          }}
        >
          {list.map((u, i) => (
            <img
              key={i}
              src={u}
              alt={`${search || ""} ${i + 1}/${list.length}`}
              draggable={false}
              className="gallery-img"
              style={{ width: size, height: size }}
            />
          ))}
        </div>

        {index > 0 && (
          <button
            type="button"
            className="gallery-arrow gallery-arrow-left"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => go(index - 1)}
            aria-label="Image précédente"
          >
            ‹
          </button>
        )}
        {index < list.length - 1 && (
          <button
            type="button"
            className="gallery-arrow gallery-arrow-right"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => go(index + 1)}
            aria-label="Image suivante"
          >
            ›
          </button>
        )}
      </div>

      <div className="gallery-dots">
        {list.map((_, i) => (
          <button
            type="button"
            key={i}
            className={`gallery-dot${i === index ? " active" : ""}`}
            onClick={() => go(i)}
            aria-label={`Image ${i + 1} sur ${list.length}`}
          />
        ))}
      </div>
    </div>
  );
}
