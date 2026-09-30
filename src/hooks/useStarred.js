import { useCallback, useState } from 'react';

// Stars are saved in this browser, so each employee keeps their own list.
const STAR_STORAGE_KEY = 'regalisViewer.starredClients';

function loadStarred() {
  try {
    const saved = JSON.parse(localStorage.getItem(STAR_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(saved) ? saved : []);
  } catch (e) {
    return new Set();
  }
}

function saveStarred(set) {
  try {
    localStorage.setItem(STAR_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    /* storage blocked: stars still work until the page is reloaded */
  }
}

export function useStarred() {
  const [starred, setStarred] = useState(loadStarred);

  const toggleStar = useCallback((key) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveStarred(next);
      return next;
    });
  }, []);

  return { starred, toggleStar };
}
