import { useEffect, useRef, useState } from "react";
import { beep } from "@/lib/voice-clips";

type Props = { qibla: number | null; cityName: string; playClip: (key: string) => boolean };

export function QiblaCompass({ qibla, cityName, playClip }: Props) {
  const [heading, setHeading] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const aligned = useRef(false);
  const lastTick = useRef(0);

  useEffect(() => {
    if (!active) return;
    const onOri = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      if (typeof e.webkitCompassHeading === "number") setHeading(e.webkitCompassHeading);
      else if (e.alpha != null) setHeading((360 - e.alpha) % 360);
    };
    const evt = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
    window.addEventListener(evt, onOri as EventListener, true);
    return () => window.removeEventListener(evt, onOri as EventListener, true);
  }, [active]);

  const rel = qibla != null && heading != null ? (qibla - heading + 360) % 360 : qibla ?? 0;
  const diff = Math.min(rel, 360 - rel);

  // Audio cues: ticks speed up as you get closer, chime + recorded clip when aligned.
  useEffect(() => {
    if (!active || heading == null || qibla == null) return;
    const now = Date.now();
    if (diff <= 8) {
      if (!aligned.current) {
        aligned.current = true;
        beep(660, 200); setTimeout(() => beep(880, 200), 220); setTimeout(() => beep(1320, 400), 440);
        navigator.vibrate?.([200, 100, 400]);
        setTimeout(() => playClip("qibla_ok"), 900);
      }
      return;
    }
    if (diff > 15) aligned.current = false;
    const gap = 200 + diff * 8;
    if (now - lastTick.current > gap) { lastTick.current = now; beep(440, 60, 0.25); }
  }, [heading, diff, active, qibla, playClip]);

  const start = async () => {
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof D.requestPermission === "function") {
      try { if ((await D.requestPermission()) !== "granted") return; } catch { return; }
    }
    setActive(true);
    beep(880, 150);
    playClip("qibla_turn");
  };

  const isAligned = active && heading != null && diff <= 8;

  return (
    <div className={`flex flex-col items-center gap-6 rounded-3xl border-8 p-6 ${isAligned ? "border-gold bg-gold text-gold-foreground" : "border-gold bg-secondary"}`}>
      <p className="text-4xl font-bold">اتِّجَاهُ القِبْلَةِ</p>
      <div className="relative aspect-square w-full max-w-[min(90vw,32rem)] rounded-full border-[12px] border-gold bg-secondary shadow-[0_0_80px_var(--gold)]">
        <span className="absolute left-1/2 top-3 -translate-x-1/2 text-3xl font-bold text-gold">ش</span>
        <div
          className="absolute inset-0 flex items-start justify-center transition-transform duration-300 ease-out"
          style={{ transform: `rotate(${rel}deg)` }}
          aria-hidden
        >
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <polygon points="50,6 72,52 56,48 56,88 44,88 44,48 28,52" className="fill-gold stroke-gold-foreground" strokeWidth="2" />
            <text x="50" y="30" textAnchor="middle" fontSize="9" className="fill-gold-foreground">🕋</text>
          </svg>
        </div>
      </div>
      <p className="text-center text-3xl font-bold">
        {!active ? `${qibla?.toFixed(0) ?? "..."}° مِنَ الشَّمَالِ — ${cityName}`
          : heading == null ? "حَرِّكِ الهَاتِفَ قَلِيلًا..."
          : isAligned ? "✓ أَنْتَ بِاتِّجَاهِ القِبْلَةِ" : "اسْتَدِرْ بِبُطْءٍ مَعَ السَّهْمِ"}
      </p>
      {!active && (
        <button onClick={start} className="rounded-2xl bg-gold px-10 py-5 text-3xl font-bold text-gold-foreground">
          ▶ ابْدَأِ البُوصَلَةَ الصَّوْتِيَّةَ
        </button>
      )}
    </div>
  );
}
