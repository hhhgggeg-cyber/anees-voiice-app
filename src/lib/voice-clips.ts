// Human-recorded announcement clips (no TTS). Stored locally in IndexedDB.
export type ClipDef = { key: string; label: string };

const HOURS = ["سَاعَةٌ وَاحِدَةٌ", "سَاعَتَانِ", "ثَلَاثُ سَاعَاتٍ", "أَرْبَعُ سَاعَاتٍ", "خَمْسُ سَاعَاتٍ", "سِتُّ سَاعَاتٍ", "سَبْعُ سَاعَاتٍ", "ثَمَانِي سَاعَاتٍ", "تِسْعُ سَاعَاتٍ", "عَشْرُ سَاعَاتٍ", "إِحْدَى عَشْرَةَ سَاعَةً", "اثْنَتَا عَشْرَةَ سَاعَةً"];
const MINS = ["خَمْسُ دَقَائِقَ", "عَشْرُ دَقَائِقَ", "رُبْعُ سَاعَةٍ", "عِشْرُونَ دَقِيقَةً", "خَمْسٌ وَعِشْرُونَ دَقِيقَةً", "نِصْفُ سَاعَةٍ", "خَمْسٌ وَثَلَاثُونَ دَقِيقَةً", "أَرْبَعُونَ دَقِيقَةً", "خَمْسٌ وَأَرْبَعُونَ دَقِيقَةً", "خَمْسُونَ دَقِيقَةً", "خَمْسٌ وَخَمْسُونَ دَقِيقَةً"];

export const CLIP_DEFS: ClipDef[] = [
  { key: "next", label: "الصَّلَاةُ القَادِمَةُ" },
  { key: "Fajr", label: "صَلَاةُ الفَجْرِ" },
  { key: "Dhuhr", label: "صَلَاةُ الظُّهْرِ" },
  { key: "Asr", label: "صَلَاةُ العَصْرِ" },
  { key: "Maghrib", label: "صَلَاةُ المَغْرِبِ" },
  { key: "Isha", label: "صَلَاةُ العِشَاءِ" },
  { key: "remaining", label: "بَاقٍ عَلَيْهَا" },
  { key: "and", label: "وَ" },
  ...HOURS.map((label, i) => ({ key: `h${i + 1}`, label })),
  ...MINS.map((label, i) => ({ key: `m${(i + 1) * 5}`, label })),
  { key: "qibla_ok", label: "أَنْتَ الآنَ بِاتِّجَاهِ القِبْلَةِ" },
  { key: "qibla_turn", label: "اسْتَدِرْ بِبُطْءٍ حَتَّى تَسْمَعَ الجَرَسَ" },
];

const DB = "anees-clips";
const STORE = "clips";
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function saveClip(key: string, blob: Blob) {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
export async function loadAllClips(): Promise<Record<string, string>> {
  const db = await open();
  return new Promise((res) => {
    const out: Record<string, string> = {};
    const tx = db.transaction(STORE, "readonly");
    const cur = tx.objectStore(STORE).openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) { out[String(c.key)] = URL.createObjectURL(c.value as Blob); c.continue(); } else res(out);
    };
    cur.onerror = () => res(out);
  });
}

/** Build the clip sequence for "next prayer is X, remaining H and M". */
export function announcementKeys(prayerKey: string, minutesLeft: number): string[] {
  const h = Math.floor(minutesLeft / 60);
  let m = Math.round((minutesLeft % 60) / 5) * 5;
  let hh = h;
  if (m === 60) { hh += 1; m = 0; }
  if (hh === 0 && m === 0) m = 5;
  const keys = ["next", prayerKey, "remaining"];
  if (hh > 0) keys.push(`h${Math.min(hh, 12)}`);
  if (hh > 0 && m > 0) keys.push("and");
  if (m > 0) keys.push(`m${m}`);
  return keys;
}

// Simple non-speech tones (chimes/beeps) via Web Audio.
let ctx: AudioContext | null = null;
export function beep(freq = 880, ms = 160, vol = 0.4) {
  ctx ??= new AudioContext();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = freq;
  o.type = "sine";
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + ms / 1000);
}
