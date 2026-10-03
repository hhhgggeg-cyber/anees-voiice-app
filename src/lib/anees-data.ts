const ia = (id: string, file: string) =>
  `https://archive.org/download/${id}/${encodeURIComponent(file)}`;

export const AJMI_BASE = "https://everyayah.com/data/Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net";
export const ayahAudio = (surah: number, ayah: number) =>
  `${AJMI_BASE}/${String(surah).padStart(3, "0")}${String(ayah).padStart(3, "0")}.mp3`;

export type Track = { id: string; title: string; subtitle: string; url: string; keywords: string[] };

export const ATHKAR: Track[] = [
  {
    id: "sabah",
    title: "أَذْكَارُ الصَّبَاحِ",
    subtitle: "الشَّيْخُ مِشَارِي العَفَاسِي",
    url: ia("sheikh-mishary-rashid-alafasy-azkar", "Sheikh Mishary Rashid Alafasy - أذكار الصباح.mp3"),
    keywords: ["صباح"],
  },
  {
    id: "masaa",
    title: "أَذْكَارُ المَسَاءِ",
    subtitle: "الشَّيْخُ مِشَارِي العَفَاسِي",
    url: ia("sheikh-mishary-rashid-alafasy-azkar", "Sheikh Mishary Rashid Alafasy - أذكار المساء.mp3"),
    keywords: ["مساء", "المسا"],
  },
  {
    id: "nawm",
    title: "أَذْكَارُ النَّوْمِ",
    subtitle: "أَذْكَارُ النَّوْمِ وَسُورَةُ المُلْكِ",
    url: ia("musnetpro_gmail_20161215", "اذكار النوم + سورة الملك - اذكار النوم + سورة الملك.mp3"),
    keywords: ["نوم", "النوم"],
  },
  {
    id: "atraf",
    title: "أَذْكَارُ أَطْرَافِ النَّهَارِ وَالوِرْدُ",
    subtitle: "الشَّيْخُ مِشَارِي العَفَاسِي",
    url: ia("sheikh-mishary-rashid-alafasy-azkar", "Sheikh Mishary Rashid Alafasy - اذكار الصباح والمساء.mp3"),
    keywords: ["اطراف", "ورد", "النهار"],
  },
];

export const LECTURES: Track[] = [
  {
    id: "salah",
    title: "أَحْكَامُ الصَّلَاةِ",
    subtitle: "الشَّيْخُ ابْنُ عُثَيْمِين",
    url: ia("168....MP3", "168- شرح زاد المسـتقنـع الصلاة- صلاة الجماعة- وأحكام الإمامة وله فعلها في بيته....الخ  بن عثيمين    MP3   العثيمين .mp3"),
    keywords: ["صلاه", "الصلاه"],
  },
  {
    id: "sawm",
    title: "أَحْكَامُ الصَّوْمِ",
    subtitle: "فَتَاوَى ابْنِ عُثَيْمِين فِي الصِّيَامِ",
    url: ia("uybql6isd5o9c5bvhvgrr4ebgamvjmbzddpikla5", "ov8nui6x5ewwyeo-en_01_Fataawa_by_ibn_Uthaymeen_on_Fasting.mp3"),
    keywords: ["صوم", "صيام"],
  },
  {
    id: "hajj",
    title: "أَحْكَامُ الحَجِّ",
    subtitle: "المَنْهَجُ لِمُرِيدِ العُمْرَةِ وَالحَجِّ",
    url: ia("Risalat_Hajj", "01.mp3"),
    keywords: ["حج", "الحج"],
  },
  {
    id: "dhikr",
    title: "فَضْلُ ذِكْرِ اللهِ",
    subtitle: "كَلِمَاتٌ لِلشَّيْخِ ابْنِ عُثَيْمِين",
    url: ia("MohammedBinSalehAl-othaimeen", "KalematAl-othaimeen.mp3"),
    keywords: ["ذكر", "فضل"],
  },
];

export const AZAN_URL = "https://www.islamcan.com/audio/adhan/azan1.mp3";

export type City = { id: string; name: string; country: string; lat: number; lng: number; method: number };
export const CITIES: City[] = [
  { id: "tripoli", name: "طَرَابُلُس", country: "لِيبْيَا", lat: 32.8872, lng: 13.1913, method: 5 },
  { id: "benghazi", name: "بَنْغَازِي", country: "لِيبْيَا", lat: 32.1167, lng: 20.0667, method: 5 },
  { id: "riyayna", name: "الرِّيَايْنَة", country: "لِيبْيَا", lat: 31.95, lng: 12.25, method: 5 },
  { id: "tunis", name: "تُونِس", country: "تُونِس", lat: 36.8065, lng: 10.1815, method: 18 },
  { id: "cairo", name: "القَاهِرَة", country: "مِصْر", lat: 30.0444, lng: 31.2357, method: 5 },
  { id: "algiers", name: "الجَزَائِر", country: "الجَزَائِر", lat: 36.7538, lng: 3.0588, method: 19 },
  { id: "makkah", name: "مَكَّةُ المُكَرَّمَة", country: "السُّعُودِيَّة", lat: 21.4225, lng: 39.8262, method: 4 },
];

export const PRAYERS = [
  { key: "Fajr", name: "الفَجْرُ" },
  { key: "Dhuhr", name: "الظُّهْرُ" },
  { key: "Asr", name: "العَصْرُ" },
  { key: "Maghrib", name: "المَغْرِبُ" },
  { key: "Isha", name: "العِشَاءُ" },
] as const;

export function normalizeArabic(s: string) {
  return s
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[إأآٱا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

const AR_NUMS: Record<string, number> = {
  "مرتين": 2, "اثنين": 2, "ثلاث": 3, "ثلاثه": 3, "اربع": 4, "اربعه": 4, "خمس": 5, "خمسه": 5,
  "ست": 6, "سبع": 7, "عشر": 10,
};
export function parseRepeatCount(text: string): number | null {
  const digits = text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).match(/\d+/);
  if (digits) return Math.min(50, Number(digits[0]));
  for (const [w, n] of Object.entries(AR_NUMS)) if (text.includes(w)) return n;
  return null;
}
