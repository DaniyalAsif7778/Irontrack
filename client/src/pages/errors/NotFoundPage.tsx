import { ArrowLeft, Dumbbell } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { setPageMetadata } from "../../utils/seo";

export default function NotFoundPage() {
  useEffect(() => {
    setPageMetadata({ title: "Page not found · IronTrack", robots: "noindex,nofollow" });
  }, []);

  return <main className="system-screen">
    <section className="system-card" aria-labelledby="not-found-title">
      <Link className="system-brand" to="/" aria-label="IronTrack sign in"><Dumbbell size={19} /><b>IronTrack</b></Link>
      <p className="system-code">404</p>
      <h1 id="not-found-title">This page isn’t here</h1>
      <p className="system-copy">The address may be out of date or the page may have moved. Head back to your account and continue from there.</p>
      <Link className="system-action" to="/"><ArrowLeft size={16} /> Back to sign in</Link>
    </section>
  </main>;
}
