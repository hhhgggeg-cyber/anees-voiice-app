import { useRef, useState } from "react";
import { CLIP_DEFS, saveClip } from "@/lib/voice-clips";

type Props = { clips: Record<string, string>; onSaved: () => void };

export function RecordClips({ clips, onSaved }: Props) {
  const [recording, setRecording] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  const start = async (key: string) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => chunks.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      await saveClip(key, new Blob(chunks, { type: mr.mimeType }));
      setRecording(null);
      onSaved();
    };
    recRef.current = mr;
    mr.start();
    setRecording(key);
  };
  const stop = () => recRef.current?.stop();

  const done = CLIP_DEFS.filter((c) => clips[c.key]).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-3xl bg-card p-6 text-card-foreground">
        <h2 className="text-4xl font-bold text-primary">تَسْجِيلُ الإِعْلَانَاتِ الصَّوْتِيَّةِ</h2>
        <p className="mt-3 text-2xl">
          يُسَجِّلُ أَحَدُ أَفْرَادِ العَائِلَةِ كُلَّ عِبَارَةٍ بِصَوْتِهِ مَرَّةً وَاحِدَةً، فَيَسْمَعُهَا أَنِيسٌ لِلإِعْلَانِ عَنِ الصَّلَاةِ القَادِمَةِ وَالقِبْلَةِ.
        </p>
        <p className="mt-2 text-2xl font-bold">تَمَّ: {done} / {CLIP_DEFS.length}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {CLIP_DEFS.map((c) => {
          const isRec = recording === c.key;
          return (
            <div key={c.key} className="flex items-center justify-between gap-3 rounded-2xl border-4 border-gold bg-card p-4 text-card-foreground">
              <p className="text-2xl font-bold">{c.label}</p>
              <div className="flex gap-2">
                {clips[c.key] && !isRec && (
                  <button onClick={() => void new Audio(clips[c.key]).play()} className="rounded-xl border-2 border-primary px-4 py-2 text-xl">▶</button>
                )}
                <button
                  onClick={() => (isRec ? stop() : void start(c.key))}
                  disabled={!!recording && !isRec}
                  className={`rounded-xl px-4 py-2 text-xl font-bold ${isRec ? "mic-listening text-destructive-foreground" : clips[c.key] ? "bg-primary text-primary-foreground" : "bg-gold text-gold-foreground"}`}
                >
                  {isRec ? "■ إِيقَافٌ" : clips[c.key] ? "إِعَادَةٌ" : "● سَجِّلْ"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
