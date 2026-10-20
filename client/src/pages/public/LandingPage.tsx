import { Activity, ArrowUpRight, CalendarDays, Check, Dumbbell, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";

const anchors = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

export default function LandingPage() {
  return <main className="public-page">
    <header className="public-nav">
      <Link className="public-brand" to="/" aria-label="IronTrack home"><span><Dumbbell size={18} /></span><b>IronTrack</b></Link>
      <nav aria-label="Account"><Link className="public-signin" to="/login">Sign in</Link><Link className="public-cta public-cta-small" to="/signup">Create account</Link></nav>
    </header>

    <section className="public-hero" aria-labelledby="public-title">
      <div className="public-copy">
        <p className="public-kicker"><span /> A steadier way to train and follow through</p>
        <h1 id="public-title">Make room for the work that matters.</h1>
        <p className="public-intro">Bring your daily routine, strength training, and progress into one calm space shaped around the rhythm of your prayers.</p>
        <div className="public-actions"><Link className="public-cta" to="/signup">Create your account <ArrowUpRight size={16} /></Link><Link className="public-secondary" to="/login">I already have an account</Link></div>
        <p className="public-privacy"><LockKeyhole size={14} /> Your routines and training history stay private to your account.</p>
      </div>

      <aside className="prayer-preview" aria-label="IronTrack routine organized around five prayer anchors">
        <div className="prayer-preview-heading"><div><small>Your day, in its own rhythm</small><b>Five anchors. Your tasks.</b></div><CalendarDays size={18} aria-hidden="true" /></div>
        <div className="prayer-rail" aria-hidden="true" />
        <ol>{anchors.map((anchor, index) => <li key={anchor} className={index === 1 ? "has-example" : ""}>
          <span className="prayer-dot">{index === 1 && <Check size={11} />}</span>
          <b>{anchor}</b>
          <span className="prayer-time">Your time</span>
          {index === 1 && <small>Tasks continue in order</small>}
        </li>)}</ol>
        <p className="prayer-note">Set your own prayer times. Shift a task, and the routine moves with it.</p>
      </aside>
    </section>

    <section className="public-features" aria-labelledby="features-title">
      <div className="public-section-heading"><p>Built for the whole day</p><h2 id="features-title">A clear place to begin, and a way to see your progress.</h2></div>
      <div className="public-feature-list">
        <article><span><CalendarDays size={18} /></span><div><h3>Routines around prayer</h3><p>Place tasks in five prayer-anchored cards, set time blocks, and keep delays from crowding the next part of your day.</p></div></article>
        <article><span><Dumbbell size={18} /></span><div><h3>Focused strength sessions</h3><p>Follow your dumbbell plan, record each set, and carry your last session forward when you train again.</p></div></article>
        <article><span><Activity size={18} /></span><div><h3>Progress you can understand</h3><p>Review your routine, training, weight, and small wellness check-ins together over time.</p></div></article>
      </div>
    </section>

    <footer className="public-footer"><Link className="public-brand" to="/" aria-label="IronTrack home"><span><Dumbbell size={16} /></span><b>IronTrack</b></Link><span>Strength, with intention.</span><Link to="/signup">Start with your own rhythm</Link></footer>
  </main>;
}
