import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ATHKAR, LECTURES, AZAN_URL, CITIES, PRAYERS, ayahAudio, normalizeArabic, parseRepeatCount, type Track,
} from "@/lib/anees-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "أنيس – رفيقك الإسلامي الصوتي" },
      { name: "description", content: "أنيس: تطبيق صوتي بالكامل لكبار السن — القرآن بصوت العجمي، الأذكار بصوت العفاسي، دروس ابن عثيمين ومواقيت الصلاة." },
      { property: "og:title", content: "أنيس – رفيقك الإسلامي الصوتي" },
      { property: "og:description", content: "قرآن، أذكار، دروس ومواقيت صلاة — بالصوت فقط." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Anees,
});

type Section = "home" | "quran" | "athkar" | "lectures" | "prayer";
type SurahMeta = { number: number; name: string; numberOfAyahs: number };
type Ayah = { numberInSurah: number; text: string };
type Timings = Record<string, string>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SR = any;

function Anees() {
  const [section, setSection] = useState<Section>("home");
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [supported, setSupported] = useState(true);

  // audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [nowTitle, setNowTitle] = useState("");
  const [trackId, setTrackId] = useState<string | null>(null);

  // quran
  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [surah, setSurah] = useState<SurahMeta | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [activeAyah, setActiveAyah] = useState<number>(0); // 0 = basmala
  const [repeat, setRepeat] = useState(0); // 0 off, -1 infinite, n times
  const repeatLeft = useRef(0);
  const quranMode = useRef(false);
  const queueRef = useRef<{ surah: number; ayah: number; total: number } | null>(null);

  // prayer
  const [cityId, setCityId] = useState("tripoli");
  const [timings, setTimings] = useState<Timings | null>(null);
  const [qibla, setQibla] = useState<number | null>(null);
  const [azanAlert, setAzanAlert] = useState<string | null>(null);
  const lastAzan = useRef("");
  const [notice, setNotice] = useState("");

  // radio + sequences + recorded clips
  const [radio, setRadio] = useState<{ ch: number; i: number } | null>(null);
  const radioRef = useRef<{ ch: number; i: number } | null>(null);
  const seqRef = useRef<string[]>([]);
  const [clips, setClips] = useState<Record<string, string>>({});
  const endedRef = useRef<() => void>(() => {});

  const recRef = useRef<SR>(null);
  const handleRef = useRef<(t: string) => void>(() => {});

  // ---------- speech recognition ----------
  const startListening = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    try { rec.start(); } catch { /* already started */ }
  }, []);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { setSupported(false); return; }
    const rec = new Ctor();
    rec.lang = "ar-SA";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (e: SR) => {
      const t = e.results[0][0].transcript as string;
      setHeard(t);
      handleRef.current(t);
    };
    recRef.current = rec;
    return () => rec.abort();
  }, []);

  // ---------- audio core ----------
  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    audioRef.current = a;
    a.onplay = () => setPlaying(true);
    a.onpause = () => setPlaying(false);
    a.onended = () => {
      setPlaying(false);
      endedRef.current();
    };
    a.onerror = () => { if (radioRef.current) endedRef.current(); };
    return () => { a.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playUrl = (url: string) => {
    const a = audioRef.current!;
    recRef.current?.abort();
    a.src = url;
    void a.play().catch(() => setPlaying(false));
  };

  const resetModes = () => {
    quranMode.current = false;
    radioRef.current = null;
    setRadio(null);
    seqRef.current = [];
    setTrackId(null);
  };

  const playTrack = (t: Track) => {
    resetModes();
    setTrackId(t.id);
    setNowTitle(`${t.title} — ${t.subtitle}`);
    playUrl(t.url);
  };

  // ---------- fatwa radio (continuous playlist) ----------
  const playRadio = (ch: number, i: number) => {
    const c = FATWA[ch];
    if (!c) return;
    resetModes();
    const idx = i % c.files.length;
    radioRef.current = { ch, i: idx };
    setRadio({ ch, i: idx });
    setSection("radio");
    setNowTitle(`📻 ${c.title} — ابْنُ عُثَيْمِين`);
    playUrl(c.files[idx]!);
  };

  // ---------- recorded announcement clips ----------
  const refreshClips = useCallback(() => { void loadAllClips().then(setClips).catch(() => {}); }, []);
  useEffect(() => { refreshClips(); }, [refreshClips]);
  const clipsRef = useRef(clips);
  clipsRef.current = clips;

  const playSequence = (urls: string[], title: string) => {
    resetModes();
    seqRef.current = urls.slice(1);
    setNowTitle(title);
    playUrl(urls[0]!);
  };
  const playClip = useCallback((key: string) => {
    const u = clipsRef.current[key];
    if (!u) return false;
    const a = audioRef.current!;
    quranMode.current = false; radioRef.current = null; seqRef.current = [];
    a.src = u; void a.play().catch(() => {});
    return true;
  }, []);

  const announceNext = () => {
    if (!timings) { setNotice("جَارٍ تَحْمِيلُ المَوَاقِيتِ..."); return; }
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const list = PRAYERS.map((p) => {
      const [h, m] = (timings[p.key] ?? "00:00").slice(0, 5).split(":").map(Number);
      return { p, t: (h ?? 0) * 60 + (m ?? 0) };
    });
    let next = list.find((x) => x.t > cur);
    let left: number;
    if (next) left = next.t - cur; else { next = list[0]!; left = next.t + 1440 - cur; }
    const hh = Math.floor(left / 60), mm = left % 60;
    setNotice(`الصَّلَاةُ القَادِمَةُ: ${next.p.name} — بَاقٍ ${hh ? `${hh} سَاعَة وَ` : ""}${mm} دَقِيقَة`);
    const keys = announcementKeys(next.p.key, left);
    const urls = keys.map((k) => clipsRef.current[k]);
    if (urls.every(Boolean)) {
      playSequence(urls as string[], `🔊 ${next.p.name}`);
    } else {
      // Fallback (no recordings yet): chimes — count = prayer order (1 Fajr … 5 Isha), then azan intro.
      const n = PRAYERS.findIndex((p) => p.key === next!.p.key) + 1;
      for (let k = 0; k < n; k++) setTimeout(() => beep(988, 350, 0.5), k * 600);
      setNotice((s) => `${s}\n(لَمْ تُسَجَّلِ الإِعْلَانَاتُ الصَّوْتِيَّةُ بَعْدُ — اضْغَطْ «تَسْجِيلُ الإِعْلَانَاتِ»)`);
      setTimeout(startListening, n * 600 + 500);
    }
  };

  endedRef.current = () => {
    if (quranMode.current && advanceQuran()) return;
    quranMode.current = false;
    if (seqRef.current.length) { const u = seqRef.current.shift()!; playUrl(u); return; }
    const r = radioRef.current;
    if (r) { playRadio(r.ch, r.i + 1); return; }
    startListening();
  };

  // ---------- quran ----------
  useEffect(() => {
    fetch("https://api.alquran.cloud/v1/surah")
      .then((r) => r.json())
      .then((j) => setSurahs(j.data))
      .catch(() => {});
  }, []);

  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;

  const playAyah = (s: number, ayah: number) => {
    radioRef.current = null; setRadio(null); seqRef.current = [];
    setActiveAyah(ayah);
    playUrl(ayah === 0 ? ayahAudio(1, 1) : ayahAudio(s, ayah));
    if (ayah > 0) document.getElementById(`ayah-${ayah}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  function advanceQuran(): boolean {
    const q = queueRef.current;
    if (!q) return false;
    const r = repeatRef.current;
    if (q.ayah > 0 && (r === -1 || repeatLeft.current > 0)) {
      if (r !== -1) repeatLeft.current -= 1;
      playAyah(q.surah, q.ayah);
      return true;
    }
    if (q.ayah >= q.total) { queueRef.current = null; return false; }
    q.ayah += 1;
    repeatLeft.current = r > 0 ? r - 1 : 0;
    playAyah(q.surah, q.ayah);
    return true;
  }

  const openSurah = async (meta: SurahMeta, autoplay = true) => {
    setSection("quran");
    setSurah(meta);
    setAyahs([]);
    const j = await fetch(`https://api.alquran.cloud/v1/surah/${meta.number}/quran-uthmani`).then((r) => r.json());
    let list: Ayah[] = j.data.ayahs;
    if (meta.number !== 1 && meta.number !== 9 && list[0]) {
      list = [{ ...list[0], text: list[0].text.startsWith("بِسْمِ") ? list[0].text.split(" ").slice(4).join(" ") : list[0].text }, ...list.slice(1)];
    }
    setAyahs(list);
    if (autoplay) {
      quranMode.current = true;
      setTrackId(null);
      setNowTitle(`${meta.name} — الشَّيْخُ أَحْمَدُ العَجَمِي`);
      const startWithBasmala = meta.number !== 1 && meta.number !== 9;
      queueRef.current = { surah: meta.number, ayah: startWithBasmala ? 0 : 1, total: meta.numberOfAyahs };
      repeatLeft.current = repeatRef.current > 0 ? repeatRef.current - 1 : 0;
      playAyah(meta.number, startWithBasmala ? 0 : 1);
    }
  };

  const playFromAyah = (n: number) => {
    if (!surah) return;
    quranMode.current = true;
    queueRef.current = { surah: surah.number, ayah: n, total: surah.numberOfAyahs };
    repeatLeft.current = repeat > 0 ? repeat - 1 : 0;
    playAyah(surah.number, n);
  };

  const findSurah = (text: string) => {
    const t = normalizeArabic(text).replace(/سوره/g, "").replace(/\s+/g, "");
    let best: SurahMeta | null = null;
    let bestLen = 0;
    for (const s of surahs) {
      const n = normalizeArabic(s.name).replace(/سوره/g, "").replace(/\s+/g, "");
      const bare = n.replace(/^ال/, "");
      if (bare.length >= 2 && (t.includes(n) || t.includes(bare)) && bare.length > bestLen) {
        best = s; bestLen = bare.length;
      }
    }
    return best;
  };

  // ---------- prayer ----------
  useEffect(() => {
    const c = CITIES.find((x) => x.id === cityId)!;
    setTimings(null);
    fetch(`https://api.aladhan.com/v1/timings?latitude=${c.lat}&longitude=${c.lng}&method=${c.method}`)
      .then((r) => r.json()).then((j) => setTimings(j.data.timings)).catch(() => {});
    fetch(`https://api.aladhan.com/v1/qibla/${c.lat}/${c.lng}`)
      .then((r) => r.json()).then((j) => setQibla(j.data.direction)).catch(() => {});
  }, [cityId]);

  useEffect(() => {
    if (!timings) return;
    const id = setInterval(() => {
      const now = new Date();
      const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      for (const p of PRAYERS) {
        const key = `${now.toDateString()}-${p.key}`;
        if (timings[p.key]?.slice(0, 5) === hm && lastAzan.current !== key) {
          lastAzan.current = key;
          setAzanAlert(p.name);
          resetModes();
          setNowTitle(`أَذَانُ ${p.name}`);
          playUrl(AZAN_URL);
        }
      }
    }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timings]);

  // ---------- commands ----------
  handleRef.current = (raw: string) => {
    const t = normalizeArabic(raw);
    if (t.includes("كرر") || t.includes("تكرار")) {
      const n = parseRepeatCount(t);
      const next = n ? n : repeat === 0 ? -1 : 0;
      setRepeat(next);
      repeatLeft.current = next > 0 ? next - 1 : 0;
      return;
    }
    if (t.includes("توقف") || t.includes("قف") || t.includes("اسكت")) { audioRef.current?.pause(); return; }
    if (t.includes("صباح")) { setSection("athkar"); return playTrack(ATHKAR[0]!); }
    if (t.includes("مساء") || t.includes("المسا")) { setSection("athkar"); return playTrack(ATHKAR[1]!); }
    if (t.includes("نوم")) { setSection("athkar"); return playTrack(ATHKAR[2]!); }
    if (t.includes("اذكار") || t.includes("ورد") || t.includes("اطراف")) { setSection("athkar"); return playTrack(ATHKAR[3]!); }
    if (t.includes("راديو") || t.includes("فتاوي") || t.includes("فتوي") || t.includes("محاضر") || t.includes("درس")) {
      const idx = FATWA.findIndex((c) => c.keywords.some((k) => t.includes(k)));
      return playRadio(idx >= 0 ? idx : 0, 0);
    }
    if (t.includes("التاليه") || t.includes("بعدها")) { if (radioRef.current) playRadio(radioRef.current.ch, radioRef.current.i + 1); return; }
    if (t.includes("قبله")) { setSection("prayer"); playClip("qibla_turn"); return; }
    if (t.includes("مواقيت") || t.includes("الصلاه") || t.includes("صلاه") || t.includes("القادمه")) { setSection("prayer"); announceNext(); return; }
    if (t.includes("تسجيل")) { setSection("record"); return; }
    const s = findSurah(t);
    if (s) { void openSurah(s); return; }
    if (t.includes("قران") || t.includes("سوره")) {
      const fatiha = surahs[0];
      if (fatiha) void openSurah(fatiha); else setSection("quran");
      return;
    }
    if (t.includes("رجوع") || t.includes("الرئيسيه")) { setSection("home"); return; }
  };

  const micClick = () => {
    if (listening) { recRef.current?.abort(); return; }
    audioRef.current?.pause();
    startListening();
  };

  const city = CITIES.find((c) => c.id === cityId)!;

  return (
    <main dir="rtl" lang="ar" className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 pb-44 pt-6">
      <header className="flex items-center justify-between">
        <button onClick={() => setSection("home")} className="text-right">
          <h1 className="text-5xl font-bold text-gold">أَنِيس</h1>
          <p className="text-lg opacity-90">رَفِيقُكَ فِي الذِّكْرِ وَالقُرْآنِ</p>
        </button>
        {section !== "home" && (
          <button onClick={() => setSection("home")} className="rounded-2xl border-4 border-gold px-6 py-3 text-2xl font-bold">
            الرَّئِيسِيَّةُ
          </button>
        )}
      </header>

      {azanAlert && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-3xl bg-gold p-6 text-gold-foreground">
          <p className="text-4xl font-bold">حَانَ الآنَ مَوْعِدُ صَلَاةِ {azanAlert}</p>
          <button onClick={() => { setAzanAlert(null); audioRef.current?.pause(); }} className="rounded-2xl bg-secondary px-6 py-3 text-2xl text-secondary-foreground">
            إِغْلَاقٌ
          </button>
        </div>
      )}

      {/* Mic */}
      <section className="flex flex-col items-center gap-5 py-4">
        <button
          onClick={micClick}
          aria-label={listening ? "يستمع الآن" : "اضغط أو تكلم"}
          className={`flex h-56 w-56 items-center justify-center rounded-full transition-colors ${listening ? "mic-listening" : "mic-idle"}`}
        >
          <svg viewBox="0 0 24 24" className="h-28 w-28 fill-current"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/></svg>
        </button>
        <p className={`text-4xl font-bold ${listening ? "text-listening" : "text-gold"}`}>
          {listening ? "تَكَلَّمِ الآنَ... أَنَا أَسْمَعُكَ" : "إِضْغَطْ أَوْ تَكَلَّمْ"}
        </p>
        {heard && <p className="text-2xl opacity-80">سَمِعْتُ: «{heard}»</p>}
        {!supported && <p className="rounded-xl bg-card p-4 text-xl text-card-foreground">المُتَصَفِّحُ لَا يَدْعَمُ الأَوَامِرَ الصَّوْتِيَّةَ، اسْتَخْدِمْ Chrome.</p>}
      </section>

      {section === "home" && (
        <section className="grid gap-6 sm:grid-cols-2">
          {[
            { s: "quran" as const, t: "القُرْآنُ الكَرِيمُ", d: "قُلْ: «سُورَةُ يس»" },
            { s: "athkar" as const, t: "الأَذْكَارُ", d: "قُلْ: «أَذْكَارُ الصَّبَاحِ»" },
            { s: "radio" as const, t: "رَادِيُو الفَتَاوَى", d: "قُلْ: «رَادِيُو الفَتَاوَى»" },
            { s: "prayer" as const, t: "مَوَاقِيتُ الصَّلَاةِ وَالقِبْلَةُ", d: "قُلْ: «مَوَاقِيتُ الصَّلَاةِ»" },
          ].map((c) => (
            <button
              key={c.s}
              onClick={() => (c.s === "radio" ? playRadio(radio?.ch ?? 0, radio?.i ?? 0) : c.s === "prayer" ? (setSection("prayer"), announceNext()) : setSection(c.s))}
              className="rounded-3xl border-4 border-gold bg-card p-8 text-right text-card-foreground"
            >
              <h2 className="text-4xl font-bold text-primary">{c.t}</h2>
              <p className="mt-3 text-2xl text-muted-foreground">{c.d}</p>
            </button>
          ))}
        </section>
      )}

      {section === "quran" && (
        <section className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={surah?.number ?? ""}
              onChange={(e) => { const m = surahs.find((s) => s.number === Number(e.target.value)); if (m) void openSurah(m); }}
              className="rounded-2xl bg-card px-5 py-4 text-2xl text-card-foreground"
            >
              <option value="" disabled>اخْتَرْ سُورَةً</option>
              {surahs.map((s) => <option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}
            </select>
            <button
              onClick={() => { const n = repeat === 0 ? -1 : 0; setRepeat(n); repeatLeft.current = 0; }}
              className={`rounded-2xl border-4 px-6 py-4 text-2xl font-bold ${repeat !== 0 ? "border-gold bg-gold text-gold-foreground" : "border-gold"}`}
            >
              {repeat === 0 ? "تَكْرَارُ الآيَةِ: مُتَوَقِّفٌ" : repeat === -1 ? "تَكْرَارُ الآيَةِ: مُسْتَمِرٌّ" : `تَكْرَارٌ ${repeat} مَرَّاتٍ`}
            </button>
            {[3, 5].map((n) => (
              <button key={n} onClick={() => { setRepeat(n); repeatLeft.current = n - 1; }} className="rounded-2xl border-4 border-gold px-5 py-4 text-2xl">
                ×{n}
              </button>
            ))}
          </div>
          {surah ? (
            <article className="rounded-3xl border-4 border-gold bg-card p-6 text-card-foreground sm:p-10">
              <h2 className="mb-2 text-center text-5xl font-bold text-primary">{surah.name}</h2>
              <p className="mb-6 text-center text-xl text-muted-foreground">بِصَوْتِ الشَّيْخِ أَحْمَدَ العَجَمِي</p>
              {surah.number !== 1 && surah.number !== 9 && (
                <p className={`mb-6 text-center font-quran text-4xl leading-loose ${activeAyah === 0 && quranMode.current ? "ayah-active" : ""}`}>
                  بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                </p>
              )}
              {ayahs.length === 0 && <p className="text-center text-2xl">جَارٍ التَّحْمِيلُ...</p>}
              <p className="text-justify font-quran text-4xl leading-[2.4]">
                {ayahs.map((a) => (
                  <span
                    key={a.numberInSurah}
                    id={`ayah-${a.numberInSurah}`}
                    onClick={() => playFromAyah(a.numberInSurah)}
                    className={`cursor-pointer px-1 ${activeAyah === a.numberInSurah ? "ayah-active" : ""}`}
                  >
                    {a.text} <span className="text-gold">﴿{a.numberInSurah.toLocaleString("ar-EG")}﴾</span>{" "}
                  </span>
                ))}
              </p>
            </article>
          ) : (
            <p className="text-3xl">قُلْ اسْمَ السُّورَةِ، مِثْلَ: «سُورَةُ المُلْكِ».</p>
          )}
        </section>
      )}

      {section === "athkar" && (
        <section className="grid gap-6 sm:grid-cols-2">
          {ATHKAR.map((t) => {
            const active = trackId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => (active && playing ? audioRef.current?.pause() : active ? audioRef.current?.play() : playTrack(t))}
                className={`rounded-3xl border-4 p-8 text-right ${active ? "border-gold bg-gold text-gold-foreground" : "border-gold bg-card text-card-foreground"}`}
              >
                <h2 className="text-4xl font-bold">{t.title}</h2>
                <p className="mt-3 text-2xl opacity-80">{t.subtitle}</p>
                <p className="mt-5 text-3xl font-bold">{active && playing ? "⏸ إِيقَافٌ مُؤَقَّتٌ" : "▶ تَشْغِيلٌ"}</p>
              </button>
            );
          })}
        </section>
      )}

      {section === "radio" && (
        <section className="flex flex-col gap-6">
          <div className="rounded-3xl border-4 border-gold bg-card p-6 text-center text-card-foreground">
            <h2 className="text-5xl font-bold text-primary">📻 رَادِيُو الفَتَاوَى</h2>
            <p className="mt-2 text-2xl text-muted-foreground">فَتَاوَى الشَّيْخِ مُحَمَّدِ بْنِ صَالِحٍ العُثَيْمِين — تَعْمَلُ تِلْقَائِيًّا بِلَا تَوَقُّفٍ</p>
            {radio && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
                <p className="text-3xl font-bold">{FATWA[radio.ch]!.title} — فَتْوَى {(radio.i + 1).toLocaleString("ar-EG")}</p>
                <button onClick={() => playRadio(radio.ch, radio.i + 1)} className="rounded-2xl bg-gold px-6 py-3 text-2xl font-bold text-gold-foreground">⏭ التَّالِيَةُ</button>
              </div>
            )}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {FATWA.map((c, idx) => {
              const active = radio?.ch === idx;
              return (
                <button
                  key={c.id}
                  onClick={() => (active && playing ? audioRef.current?.pause() : active ? audioRef.current?.play() : playRadio(idx, 0))}
                  className={`rounded-3xl border-4 border-gold p-8 text-right ${active ? "bg-gold text-gold-foreground" : "bg-card text-card-foreground"}`}
                >
                  <h3 className="text-4xl font-bold">{c.title}</h3>
                  <p className="mt-2 text-2xl opacity-80">{c.files.length.toLocaleString("ar-EG")} فَتْوَى</p>
                  <p className="mt-4 text-3xl font-bold">{active && playing ? "⏸ إِيقَافٌ" : "▶ اسْتِمَاعٌ"}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {section === "prayer" && (
        <section className="flex flex-col gap-6">
          <button onClick={announceNext} className="rounded-3xl bg-gold p-8 text-4xl font-bold text-gold-foreground">
            🔊 اسْمَعِ الصَّلَاةَ القَادِمَةَ
          </button>
          {notice && <p role="status" className="rounded-2xl bg-card p-5 text-2xl text-card-foreground">{notice}</p>}
          <select value={cityId} onChange={(e) => setCityId(e.target.value)} className="self-start rounded-2xl bg-card px-5 py-4 text-2xl text-card-foreground">
            {CITIES.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.country}</option>)}
          </select>
          <div className="grid gap-4 sm:grid-cols-5">
            {PRAYERS.map((p) => (
              <div key={p.key} className="rounded-3xl border-4 border-gold bg-card p-6 text-center text-card-foreground">
                <p className="text-3xl font-bold text-primary">{p.name}</p>
                <p className="mt-2 text-4xl font-bold tabular-nums">{timings?.[p.key] ?? "..."}</p>
              </div>
            ))}
          </div>
          <QiblaCompass qibla={qibla} cityName={city.name} playClip={playClip} />
          <div className="flex flex-wrap gap-4">
            <button onClick={() => { resetModes(); setNowTitle("الأَذَانُ"); playUrl(AZAN_URL); }} className="rounded-2xl border-4 border-gold px-6 py-4 text-2xl">
              ▶ اسْتِمَاعٌ لِلأَذَانِ
            </button>
            <button onClick={() => setSection("record")} className="rounded-2xl border-4 border-gold px-6 py-4 text-2xl">
              ● تَسْجِيلُ الإِعْلَانَاتِ ({Object.keys(clips).length}/{CLIP_DEFS.length})
            </button>
          </div>
        </section>
      )}

      {section === "record" && <RecordClips clips={clips} onSaved={refreshClips} />}

      {nowTitle && (
        <footer className="fixed inset-x-0 bottom-0 border-t-4 border-gold bg-secondary p-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <p className="text-2xl font-bold">{nowTitle}</p>
            <button
              onClick={() => (playing ? audioRef.current?.pause() : audioRef.current?.play())}
              className="rounded-2xl bg-gold px-8 py-4 text-3xl font-bold text-gold-foreground"
            >
              {playing ? "⏸ إِيقَافٌ" : "▶ تَشْغِيلٌ"}
            </button>
          </div>
        </footer>
      )}
    </main>
  );
}
