import { Link } from "react-router-dom";
import "./landing.css";

// Change this one line if the booking route is renamed in router.tsx
const BOOKING_PATH = "/book";

// Where the "Book now" buttons on the service cards go
const SIGNUP_PATH = "/sign-up";

type Service = {
  id: string;
  name: string;
  description: string;
  price: string;
};

const services: Service[] = [
  {
    id: "signature-haircut",
    name: "Signature haircut",
    description: "Consultation, tailored cut and a polished finish.",
    price: "£45",
  },
  {
    id: "silk-finish",
    name: "Silk finish",
    description: "A smooth, luminous blow-dry made to last.",
    price: "£40",
  },
  {
    id: "beard-sculpt",
    name: "Beard sculpt",
    description: "Shape, hot towel and nourishing beard care.",
    price: "£25",
  },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="nav">
        <Link to="/" className="nav__logo">The Chair &amp; Co.</Link>
        <nav className="nav__links" aria-label="Main">
          <Link to="/">Home</Link>
          <Link to={BOOKING_PATH}>Book</Link>
          <a href="#studio">Our studio</a>
          <Link to="/team">Team portal</Link>
        </nav>
        <Link to={BOOKING_PATH} className="btn btn--primary">Book an appointment</Link>
      </header>

      <section className="hero">
        <div className="hero__image" role="img" aria-label="Salon interior with oval mirrors and styling chairs" />
        <div className="hero__text">
          <p className="eyebrow">Independent salon · Soho</p>
          <h1>A chair for you. A little time for yourself.</h1>
          <p className="hero__lead">
            Expert hands, honest conversation and care that feels entirely your own.
          </p>
          <div className="hero__actions">
            <Link to={BOOKING_PATH} className="btn btn--primary">Find your appointment</Link>
            <a href="#services" className="link-underline">Explore services</a>
          </div>
        </div>
      </section>

      <section id="services" className="services">
        <p className="eyebrow">Our services</p>
        <div className="services__head">
          <h2>Carefully curated. Clearly priced.</h2>
          <p>
            Every appointment begins with listening. Choose your ritual and we’ll
            take care of the rest.
          </p>
        </div>
        <div className="services__grid">
          {services.map((s, i) => (
            <article className="service" key={s.id}>
              <span className="service__num">0{i + 1}</span>
              <h3>{s.name}</h3>
              <p>{s.description}</p>
              <div className="service__foot">
                <strong>{s.price}</strong>
                <Link to={SIGNUP_PATH}>Book now →</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="studio" className="studio">
        <div className="studio__copy">
          <p className="eyebrow eyebrow--light">The studio</p>
          <h2>Made for slowing down.</h2>
          <p>
            Natural light, good coffee, kind people and enough time to get it
            right. Welcome to your new favourite chair.
          </p>
          <Link to={BOOKING_PATH} className="btn btn--light">Book your visit</Link>
        </div>
        <figure className="studio__quote">
          <blockquote>
            “It feels less like an appointment and more like time set aside for
            yourself.”
          </blockquote>
          <figcaption>— Amara, regular since 2021</figcaption>
        </figure>
      </section>

      <section className="team-cta">
        <p className="eyebrow eyebrow--muted">For our team</p>
        <h2>Your day, beautifully organised.</h2>
        <p>Dedicated workspaces for salon owners, barbers and stylists.</p>
        <Link to="/team" className="btn btn--outline">Open team portal</Link>
      </section>

      <footer className="footer">
        <div className="footer__brand">
          <span className="footer__logo">The Chair &amp; Co.</span>
          <p>Thoughtful hair, made simple.</p>
        </div>
        <div className="footer__col">
          <h4>Visit</h4>
          <p>18 Mercer Street</p>
          <p>London, W1D 3QH</p>
        </div>
        <div className="footer__col">
          <h4>Hours</h4>
          <p>Tue–Fri, 9–7</p>
          <p>Saturday, 9–5</p>
        </div>
        <Link to="/signin" className="footer__signin">Team sign in →</Link>
      </footer>
    </div>
  );
}
