import { Logo } from '@/components/brand/Logo';
import { Marquee } from '@/components/brand/Marquee';
import { Mascot } from '@/components/brand/Mascot';
import { Tilt } from '@/components/brand/Tilt';
import { DealList } from '@/components/DealList';
import { Intake } from '@/components/Intake';

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1 className="hero-logo">
            <Logo animate />
          </h1>
          <p className="define">
            <span className="head">
              pan·ga<span className="phon">[pung-gaa]</span>
              <i>noun, Hindi</i>
            </span>
            <span className="meaning">Trouble you pick on purpose.</span>
          </p>
          {/* One line per choice: take it, change the deal, walk away. */}
          <p className="hero-q">
            <span>Lena hai?</span>
            <span>Negotiate karna hai?</span>
            <span>
              <mark>Ya chhodna hai?</mark>
            </span>
          </p>
          <p className="hero-sub">
            Paste the brief and the chat. Panga finds the <b>hidden work</b> and the <b>real hourly rate</b>, then lets you practise the call
            first.
          </p>
          <div className="row">
            <a href="#start" className="btn btn-primary btn-big">
              Pick a panga
            </a>
          </div>
        </div>
        <Tilt className="hero-art">
          <span className="rays" aria-hidden="true" />
          <p className="shout">
            Simple site hai, 15k mein ho jayega na?
            <small>Your client, every time.</small>
          </p>
          <Mascot />
          <span className="sticker">Scope-creep survival kit</span>
        </Tilt>
      </section>
      <Marquee />
      <div className="home-grid" id="start">
        <Intake />
        <DealList />
      </div>
    </>
  );
}
