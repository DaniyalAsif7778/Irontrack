import { afterEach, describe, expect, it, vi } from "vitest";
import { isNotificationSoundEnabled, notificationSoundKey, playNotificationSound } from "./notificationSound";

afterEach(() => {
  localStorage.removeItem(notificationSoundKey);
  vi.unstubAllGlobals();
});

describe("notification sound", () => {
  it("defaults to enabled, respects mute, and plays a two-tone chime when enabled", async () => {
    const oscillators: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
    class FakeAudioContext {
      state: AudioContextState = "running";
      currentTime = 0;
      destination = {} as AudioDestinationNode;
      createOscillator() {
        const oscillator = { type: "sine", frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
        oscillators.push(oscillator);
        return oscillator as unknown as OscillatorNode;
      }
      createGain() {
        return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() } as unknown as GainNode;
      }
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);

    expect(isNotificationSoundEnabled()).toBe(true);
    localStorage.setItem(notificationSoundKey, "false");
    expect(await playNotificationSound()).toBe(false);
    expect(oscillators).toHaveLength(0);

    localStorage.setItem(notificationSoundKey, "true");
    expect(await playNotificationSound()).toBe(true);
    expect(oscillators).toHaveLength(2);
    expect(oscillators.every(oscillator => oscillator.start.mock.calls.length === 1 && oscillator.stop.mock.calls.length === 1)).toBe(true);
  });
});
