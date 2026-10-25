
import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="w-full bg-[#F7F5F1] border-b border-[#DDD5CC]">
      <div className="flex items-center justify-between px-6 md:px-12 lg:px-20 h-[100px]">

        {/* Logo */}
        <Link
          to="/"
          className="font-serif text-[30px] text-[#70263E] whitespace-nowrap"
        >
          The Chair &amp; Co.
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-10 text-[#82766E] text-[18px]">

          <Link to="/" className="hover:text-[#70263E] transition-colors">
            Home
          </Link>

          <Link to="/book" className="hover:text-[#70263E] transition-colors">
            Book
          </Link>

          <Link to="/studio" className="hover:text-[#70263E] transition-colors">
            Our studio
          </Link>

          <span className="h-6 w-px bg-[#DDD5CC]" />

          <Link to="/team" className="hover:text-[#70263E] transition-colors">
            Team portal
          </Link>
        </div>

        {/* Desktop Button */}
        <Link
          to="/sign-up"
          className="hidden lg:inline-flex items-center justify-center bg-[#70263E] text-white font-semibold px-6 py-4 rounded-[4px] border-2 border-[#29221F] hover:bg-[#592033] transition-colors"
        >
          Book an appointment
        </Link>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="lg:hidden text-[#70263E]"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {menuOpen && (
        <div className="lg:hidden flex flex-col gap-5 px-6 py-6 border-t border-[#DDD5CC] text-[#82766E]">

          <Link to="/" onClick={() => setMenuOpen(false)}>
            Home
          </Link>

          <Link to="/book" onClick={() => setMenuOpen(false)}>
            Book
          </Link>

          <Link to="/studio" onClick={() => setMenuOpen(false)}>
            Our studio
          </Link>

          <Link to="/team" onClick={() => setMenuOpen(false)}>
            Team portal
          </Link>

          <Link
            to="/sign-up"
            onClick={() => setMenuOpen(false)}
            className="bg-[#70263E] text-white text-center px-6 py-4 rounded"
          >
            Book an appointment
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
