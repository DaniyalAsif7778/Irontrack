import { Component, type ErrorInfo, type ReactNode } from "react";
import { Dumbbell, RotateCw } from "lucide-react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export default class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error("IronTrack screen rendering failed.", error.name);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="system-screen" role="alert">
      <section className="system-card" aria-labelledby="app-error-title">
        <div className="system-brand"><Dumbbell size={19} /><b>IronTrack</b></div>
        <h1 id="app-error-title">This screen couldn’t load</h1>
        <p className="system-copy">Your saved account data hasn’t been changed. Reload the app and try again.</p>
        <button className="system-action" type="button" onClick={() => window.location.reload()}><RotateCw size={16} /> Reload app</button>
      </section>
    </main>;
  }
}
