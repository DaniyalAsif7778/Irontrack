import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const dismissKey = "irontrack_install_prompt_dismissed_until";

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(() => Number(localStorage.getItem(dismissKey) ?? 0) > Date.now());
  const [showHelp, setShowHelp] = useState(false);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone);

  useEffect(() => {
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  async function install() {
    if (!installEvent) { setShowHelp(value => !value); return; }
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallEvent(null);
    } catch { setShowHelp(true); }
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(dismissKey, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  }

  if (installed || dismissed || (!isIos && !installEvent)) return null;
  return <section className="install-prompt" aria-label="Install IronTrack">
    <span className="install-prompt-icon"><Download size={18} /></span>
    <div className="install-prompt-copy"><b>Keep IronTrack on your phone</b><small>Install it for quick access from your home screen.</small>{showHelp && <small className="install-help">{isIos ? <>In Safari, tap <Share size={13} /> Share, then choose <b>Add to Home Screen</b>.</> : "Open your browser menu and choose Install app or Add to Home Screen."}</small>}</div>
    <button type="button" className="install-action" onClick={() => void install()}>{installEvent ? "Install" : "How to install"}</button>
    <button type="button" className="install-dismiss" aria-label="Dismiss install suggestion" onClick={dismiss}><X size={16} /></button>
  </section>;
}
