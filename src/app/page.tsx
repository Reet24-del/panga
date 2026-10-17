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
          <div className="define">
            <div className="head">
              pan·ga<span className="phon">[pung-gaa]</span>
              <i>noun, Hindi</i>
            </div>
            <ol>
              <li>Trouble you pick on purpose.</li>
              <li>
                What <b>“a simple online store for ₹15,000”</b> turns into, three WhatsApp messages later.
              </li>
            </ol>
          </div>
          <p className="hero-q">
            Lena hai? Negotiate karna hai? <mark>Ya chhodna hai?</mark>
          </p>
          <p className="hero-sub">
            Paste the brief and the chat. Panga digs out the <b>hidden work</b>, shows what the deal <b>really pays per hour</b>, and puts you on a
            practice call with the client from hell before you say yes.
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
