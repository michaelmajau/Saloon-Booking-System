import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Menu, Scissors, X } from "lucide-react";

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 30);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const navBackground = hasScrolled
    ? "border-[#5C443A] bg-[#3A2923] shadow-lg"
    : "border-[#DDD5CC] bg-[#F7F5F1]";

  const mainText = hasScrolled ? "text-[#FFF8F0]" : "text-[#35231E]";

  const linkText = hasScrolled
    ? "text-[#E7D8CC] hover:text-[#FFF8F0]"
    : "text-[#756960] hover:text-[#70263E]";

  return (
    <nav
      className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${navBackground}`}
    >
      <div className="flex h-[58px] items-center justify-between px-6 md:px-12 lg:px-20">
        {/* Brand */}
        <Link
          to="/"
          onClick={closeMenu}
          className={`flex items-center gap-3 ${mainText}`}
          aria-label="Bookify home"
        >
          <Scissors
            size={24}
            strokeWidth={1.8}
            className={hasScrolled ? "text-[#FFF8F0]" : "text-[#70263E]"}
          />

          <span className="font-serif text-[26px] tracking-[-0.04em]">
            Bookify
          </span>
        </Link>

        {/* Desktop navigation */}
        <div className={`hidden items-center gap-10 text-sm lg:flex ${linkText}`}>
          <Link to="/" className="transition">
            Home
          </Link>

          <Link to="/dashboard#book-appointment" className="transition">
            Book
          </Link>

          <Link to="/#studio" className="transition">
            Our studio
          </Link>

          <span
            className={`h-6 w-px ${
              hasScrolled ? "bg-[#6B5145]" : "bg-[#DDD5CC]"
            }`}
          />

          <Link to="/team/login" className="transition">
            Team portal
          </Link>
        </div>

        {/* Desktop booking button */}
        <Link
          to="/dashboard#book-appointment"
          className={`hidden items-center gap-2 border-2 px-4 py-2 text-sm font-semibold transition lg:inline-flex ${
            hasScrolled
              ? "border-[#F7F0E5] bg-[#F7F0E5] text-[#3A2923] hover:bg-[#E7D8CC]"
              : "border-[#35231E] bg-[#70263E] text-white hover:bg-[#5C1E32]"
          }`}
        >
          <CalendarDays size={17} />
          Book an appointment
        </Link>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className={`lg:hidden ${
            hasScrolled ? "text-[#FFF8F0]" : "text-[#70263E]"
          }`}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile navigation */}
      {menuOpen && (
        <div
          className={`border-t px-6 py-6 lg:hidden ${
            hasScrolled
              ? "border-[#6B5145] bg-[#3A2923]"
              : "border-[#DDD5CC] bg-[#F7F5F1]"
          }`}
        >
          <div className={`flex flex-col gap-5 ${linkText}`}>
            <Link to="/" onClick={closeMenu}>
              Home
            </Link>

            <Link to="/dashboard#book-appointment" onClick={closeMenu}>
              Book
            </Link>

            <Link to="/#studio" onClick={closeMenu}>
              Our studio
            </Link>

            <Link to="/team/login" onClick={closeMenu}>
              Team portal
            </Link>

            <Link
              to="/dashboard#book-appointment"
              onClick={closeMenu}
              className={`mt-2 inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold ${
                hasScrolled
                  ? "bg-[#F7F0E5] text-[#3A2923]"
                  : "bg-[#70263E] text-white"
              }`}
            >
              <CalendarDays size={18} />
              Book an appointment
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;