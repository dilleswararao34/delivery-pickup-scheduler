import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Camera, Eye, ArrowRight, ShieldCheck, Clock, MapPin, Menu, X, ArrowUpRight } from 'lucide-react';
import apiClient from '../../services/apiClient';
import './PublicCatalog.css';

export default function PublicCatalog() {
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    async function fetchCatalog() {
      try {
        const res = await apiClient.getEquipment();
        setEquipment(res.data || []);
        
        // Extract unique categories
        const cats = Array.from(new Set((res.data || []).map(e => e.category)));
        setCategories(cats);
      } catch (err) {
        setError('Failed to load equipment catalog.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchCatalog();
  }, []);

  const filteredEquipment = categoryFilter
    ? equipment.filter(e => e.category === categoryFilter)
    : equipment;

  return (
    <div className="public-landing">
      {/* Premium Minimal Navigation Header */}
      <header className="landing-header">
        <div className="landing-header-container">
          <Link to="/" className="landing-logo-group">
            <span className="logo-badge">SD</span>
            <span className="logo-text">SD DIGITALS</span>
          </Link>
          <nav className="landing-nav-links">
            <Link to="/terms" className="nav-link">Terms</Link>
            <Link to="/privacy" className="nav-link">Privacy</Link>
            <button onClick={() => navigate('/login')} className="nav-cta-btn">
              Client Portal <ArrowRight size={14} className="cta-icon" />
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-container">
          <span className="hero-kicker">Premium Cinema Gear Rentals</span>
          <h1 className="hero-headline">
            Exceptional tools for <span className="italic-serif">visionary</span> filmmakers.
          </h1>
          <p className="hero-subheading">
            New Delhi's premier camera rental provider. Secure high-end cinema systems, lenses, and production accessories with automated real-time dispatch scheduling.
          </p>
          <div className="hero-actions">
            <a href="#catalog" className="hero-primary-btn">
              Browse Catalog
            </a>
            <button onClick={() => navigate('/login')} className="hero-secondary-btn">
              Sign In to Book <ArrowUpRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Value Pillars Section */}
      <section className="value-pillars">
        <div className="pillars-container">
          <div className="pillar-card">
            <ShieldCheck className="pillar-icon" />
            <h3>Guaranteed Availability</h3>
            <p>Our transactional double-booking prevention ensures your reserved gear is 100% secured for your shoot dates.</p>
          </div>
          <div className="pillar-card">
            <Clock className="pillar-icon" />
            <h3>Express Delivery</h3>
            <p>Tracked delivery and collection services across Delhi NCR, handled by professional logistics personnel.</p>
          </div>
          <div className="pillar-card">
            <MapPin className="pillar-icon" />
            <h3>Prime Location</h3>
            <p>Centrally located depot for fast support, equipment prep sessions, and urgent pick-ups.</p>
          </div>
        </div>
      </section>

      {/* Equipment Catalog Section */}
      <section id="catalog" className="catalog-section">
        <div className="catalog-container">
          <div className="catalog-header">
            <h2>The Rental Fleet</h2>
            <div className="category-tabs">
              <button
                className={`cat-tab ${categoryFilter === '' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('')}
              >
                All Gear
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`cat-tab ${categoryFilter === cat ? 'active' : ''}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="catalog-loader">Loading catalog details...</div>
          ) : error ? (
            <div className="catalog-error">{error}</div>
          ) : filteredEquipment.length === 0 ? (
            <div className="catalog-empty">No equipment available matching the selection.</div>
          ) : (
            <div className="catalog-grid">
              {filteredEquipment.map(item => (
                <div key={item.id} className="catalog-item-card">
                  <div className="item-card-image-stub">
                    <Camera size={48} className="camera-placeholder-icon" />
                    <span className="item-badge">{item.status}</span>
                  </div>
                  <div className="item-card-details">
                    <span className="item-category">{item.category}</span>
                    <h3 className="item-name">{item.name}</h3>
                    <p className="item-meta">
                      {item.brand} {item.model_number && `• ${item.model_number}`}
                    </p>
                    {item.description && <p className="item-desc">{item.description}</p>}
                    <div className="item-card-footer">
                      <div className="item-price">
                        <span className="price-label">Daily rate</span>
                        <span className="price-val">₹{parseFloat(item.rental_rate_per_day).toLocaleString('en-IN')}</span>
                      </div>
                      <button onClick={() => navigate('/login')} className="item-book-btn">
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Premium Minimalist Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-top">
            <div className="footer-brand">
              <span className="footer-logo">SD</span>
              <h3>SD DIGITALS</h3>
              <p>Premium Cinema Rentals &amp; Production Services</p>
            </div>
            <div className="footer-links-group">
              <h4>Quick Links</h4>
              <Link to="/login">Client Portal</Link>
            </div>
            <div className="footer-links-group">
              <h4>Legal &amp; Info</h4>
              <Link to="/terms">Terms of Service</Link>
              <Link to="/privacy">Privacy Policy</Link>
            </div>
            <div className="footer-contact">
              <h4>Delhi NCR Depot</h4>
              <p>A-34, Okhla Industrial Area, Phase II</p>
              <p>New Delhi, 110020, India</p>
              <p>Email: ops@sddigitals.in</p>
              <p>Tel: +91 11 4059 8899</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} SD Digitals. All rights reserved. All rentals are subject to standard verification &amp; damage policies.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
