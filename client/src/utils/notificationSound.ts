export const notificationSoundKey = "irontrack_notification_sound_v1";

let audioContext: AudioContext | null = null;

export function isNotificationSoundEnabled() {
  try { return localStorage.getItem(notificationSoundKey) !== "false"; }
  catch { return true; }
}

export async function playNotificationSound() {
  if (!isNotificationSoundEnabled() || typeof window === "undefined") return false;
  try {
    const Context = window.AudioContext;
    if (!Context) return false;
    if (!audioContext || audioContext.state === "closed") audioContext = new Context();
    if (audioContext.state === "suspended") await audioContext.resume();
    if (audioContext.state !== "running") return false;

    const startAt = audioContext.currentTime;
    [880, 1174].forEach((frequency, index) => {
      const start = startAt + index * 0.09;
      const oscillator = audioContext!.createOscillator();
      const volume = audioContext!.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, start);
      volume.gain.exponentialRampToValueAtTime(0.12, start + 0.025);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
      oscillator.connect(volume);
      volume.connect(audioContext!.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.25);
    });
    return true;
  } catch {
    return false;
  }
}
