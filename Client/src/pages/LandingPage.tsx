import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./landing.css";
import salonInterior from "../assets/barber.avif";
import { api, kes } from "../lib/api";

const BOOKING_PATH = "/dashboard#book-appointment";

type Service = {
  service_id: string;
  service_name: string;
  price: number;
  duration_minutes: number;
};

export default function LandingPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState("");

  useEffect(() => {
    const loadServices = async () => {
      try {
        const response = await api<{ services: Service[] }>("/services");
        setServices(response.services);
      } catch (error) {
        setServicesError(
          error instanceof Error
            ? error.message
            : "Unable to load salon services."
        );
      } finally {
        setLoadingServices(false);
      }
    };

    void loadServices();
  }, []);

  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div
          className="hero__image"
          role="img"
          aria-label="Bookify salon interior"
          style={{ backgroundImage: `url(${salonInterior})` }}
        />

        <div className="hero__text">
          <p className="eyebrow">Independent salon · Nairobi</p>

          <h1>Time for you. Made simple.</h1>

          <p className="hero__lead">
            Expert hands, honest conversation and care that feels entirely your
            own.
          </p>

          <div className="hero__actions">
            <Link to={BOOKING_PATH} className="btn btn--primary">
              Find your appointment
            </Link>

            <a href="#services" className="link-underline">
              Explore services
            </a>
          </div>
        </div>
      </section>

      {/* Services loaded from admin records */}
      <section id="services" className="services">
        <p className="eyebrow">Our services</p>

        <div className="services__head">
          <h2>Carefully curated. Clearly priced.</h2>

          <p>
            Every appointment begins with listening. Choose your service and
            we’ll take care of the rest.
          </p>
        </div>

        <div className="services__grid">
          {loadingServices && (
            <p className="text-[#82766E]">Loading services…</p>
          )}

          {servicesError && (
            <p className="text-red-700">{servicesError}</p>
          )}

          {!loadingServices && !servicesError && services.length === 0 && (
            <p className="text-[#82766E]">
              Our service menu is being updated. Please check back soon.
            </p>
          )}

          {services.map((service, index) => (
            <article className="service" key={service.service_id}>
              <span className="service__num">
                {String(index + 1).padStart(2, "0")}
              </span>

              <h3>{service.service_name}</h3>

              <p>
                {service.duration_minutes} minutes of professional salon care,
                tailored to you.
              </p>

              <div className="service__foot">
                <strong>{kes(service.price)}</strong>

                <Link to={BOOKING_PATH}>Book now →</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Studio */}
      <section id="studio" className="studio">
        <div className="studio__copy">
          <p className="eyebrow eyebrow--light">The studio</p>

          <h2>Made for slowing down.</h2>

          <p>
            Natural light, good coffee, kind people and enough time to get it
            right. Welcome to your new favourite salon.
          </p>

          <Link to={BOOKING_PATH} className="btn btn--light">
            Book your visit
          </Link>
        </div>

        <figure className="studio__quote">
          <blockquote>
            “It feels less like an appointment and more like time set aside for
            yourself.”
          </blockquote>

          <figcaption>— A valued Bookify customer</figcaption>
        </figure>
      </section>

      {/* Team call to action */}
      <section className="team-cta">
        <p className="eyebrow eyebrow--muted">For our team</p>

        <h2>Your day, beautifully organised.</h2>

        <p>Dedicated workspaces for salon owners, barbers and stylists.</p>

        <Link to="/team/login" className="btn btn--outline">
          Open team portal
        </Link>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer__brand">
          <span className="footer__logo">Bookify</span>
          <p>Thoughtful hair, made simple.</p>
        </div>

        <div className="footer__col">
          <h4>Visit</h4>
          <p>Nairobi</p>
          <p>Kenya</p>
        </div>

        <div className="footer__col">
          <h4>Hours</h4>
          <p>Tuesday–Friday, 9–7</p>
          <p>Saturday, 9–5</p>
        </div>

        <Link to="/sign-in" className="footer__signin">
          Sign in →
        </Link>
      </footer>
    </div>
  );
}