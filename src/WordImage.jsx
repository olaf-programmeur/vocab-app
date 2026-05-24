import { useEffect, useState } from "react";

const PEXELS_API_KEY =
  "eQnVpwDBZmAkbaCw4SKWHXrSzAhPuw8DtLf8rtPRahwRzwOqDumWB2Jd";

const imageCache = {};
async function fetchPexelsImage(query) {
  if (imageCache[query]) return imageCache[query];
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        query
      )}&per_page=1&orientation=square`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    const data = await res.json();
    const url = data.photos?.[0]?.src?.medium || null;
    imageCache[query] = url;
    return url;
  } catch {
    return null;
  }
}

export default function WordImage({ url: customUrl, search, size = 120 }) {
  const [url, setUrl] = useState(customUrl || null);
  const [loading, setLoading] = useState(!customUrl);

  useEffect(() => {
    if (customUrl) {
      setUrl(customUrl);
      setLoading(false);
      return;
    }
    if (!search) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchPexelsImage(search).then((u) => {
      setUrl(u);
      setLoading(false);
    });
  }, [customUrl, search]);

  if (loading) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: "#eee",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            border: "2px solid #ddd",
            borderTopColor: "#999",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  if (!url) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: "#f0ece4",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.35,
        }}
      >
        📷
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={search}
      style={{
        width: size,
        height: size,
        objectFit: "cover",
        borderRadius: 12,
        display: "block",
      }}
    />
  );
}
