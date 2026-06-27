import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Camera, Eye, ArrowRight, ShieldCheck, Clock, MapPin,
  X, ArrowUpRight, Sparkles, BadgeCheck, Loader2,
  Aperture, Film, Clapperboard, Mic2, Lightbulb, Sliders
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import ChatWidget from '../../components/ChatWidget/ChatWidget.jsx';
import EquipmentDetailModal from './EquipmentDetailModal.jsx';
import './PublicCatalog.css';

// Category → icon mapping for image stubs
const CATEGORY_ICONS = {
  'Cinema Camera': Camera,
  'Stabilizer': Sliders,
  'Lens': Eye,
  'Lighting': Lightbulb,
  'Audio': Mic2,
  'Accessories': Film,
};

function CategoryIcon({ category, size = 40 }) {
  const Icon = CATEGORY_ICONS[category] || Camera;
  return <Icon size={size} />;
}

// Staggered card animation variants
const gridContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.25, 1, 0.5, 1] } },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 1, 0.5, 1] } },
};

// Trust statistics for the social proof bar
const TRUST_STATS = [
  { value: '100+', label: 'Productions' },
  { value: '50+', label: 'Cinema systems' },
  { value: 'Delhi NCR', label: 'Same-day delivery' },
  { value: '5★', label: 'Avg. client rating' },
];

// Scroll-reveal wrapper
function RevealSection({ children, className, delay = 0 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      variants={sectionVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

export default function PublicCatalog() {
  const navigate = useNavigate();
  const [equipment, setEquipment]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories]     = useState([]);
  const [hoveredCard, setHoveredCard]   = useState(null);
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);

  const catalogRef = useRef(null);
  const catalogInView = useInView(catalogRef, { once: true, margin: '-60px' });

  useEffect(() => {
    async function fetchCatalog() {
      try {
        const res = await apiClient.getEquipment();
        setEquipment(res.data || []);
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

  const availableOnly = filteredEquipment.filter(e => e.status === 'AVAILABLE');
  const unavailable   = filteredEquipment.filter(e => e.status !== 'AVAILABLE');
  const sorted = [...availableOnly, ...unavailable]; // available first

  return (
    <div className="public-landing">

      {/* ── Sticky Navigation ────────────────────────────────────────── */}
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
              Client Portal <ArrowRight size={13} className="cta-icon" />
            </button>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="landing-hero">
        {/* Aperture ring — large faint background shape */}
        <div className="hero-aperture" aria-hidden="true">
          <Aperture className="aperture-ring" />
        </div>

        <div className="hero-container">
          {/* Trust badge */}
          <motion.div
            className="hero-trust-badge"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <BadgeCheck size={14} className="trust-badge-icon" />
            Trusted by 100+ productions across India
          </motion.div>

          <motion.span
            className="hero-kicker"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Premium Cinema Gear Rentals
          </motion.span>

          <motion.h1
            className="hero-headline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            Exceptional tools for <span className="italic-serif">visionary</span> filmmakers.
          </motion.h1>

          <motion.p
            className="hero-subheading"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.42 }}
          >
            New Delhi's premier camera rental provider. Secure high-end cinema systems,
            lenses, and production accessories with automated real-time dispatch scheduling.
          </motion.p>

          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
          >
            <a href="#catalog" className="hero-primary-btn">
              Browse Catalog
            </a>
            <button onClick={() => navigate('/login')} className="hero-secondary-btn">
              Sign In to Book <ArrowUpRight size={15} />
            </button>
          </motion.div>

          {/* Social proof statistics strip */}
          <motion.div
            className="hero-stats-strip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.75 }}
          >
            {TRUST_STATS.map((stat, i) => (
              <React.Fragment key={stat.label}>
                <div className="hero-stat">
                  <span className="hero-stat__value">{stat.value}</span>
                  <span className="hero-stat__label">{stat.label}</span>
                </div>
                {i < TRUST_STATS.length - 1 && (
                  <div className="hero-stat-divider" aria-hidden="true" />
                )}
              </React.Fragment>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Value Pillars ─────────────────────────────────────────── */}
      <RevealSection className="value-pillars">
        <div className="pillars-container">
          {[
            {
              Icon: ShieldCheck,
              title: 'Guaranteed Availability',
              desc: 'Transactional double-booking prevention ensures your reserved gear is 100% secured for your shoot dates.',
            },
            {
              Icon: Clock,
              title: 'Express Delivery',
              desc: 'Tracked delivery and collection services across Delhi NCR, handled by professional logistics personnel.',
            },
            {
              Icon: MapPin,
              title: 'Prime Location',
              desc: 'Centrally located depot for fast support, equipment prep sessions, and urgent pick-ups.',
            },
          ].map(({ Icon, title, desc }, i) => (
            <motion.div
              key={title}
              className="pillar-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.12 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <div className="pillar-icon-wrap">
                <Icon className="pillar-icon" />
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </motion.div>
          ))}
        </div>
      </RevealSection>

      {/* ── Equipment Catalog ──────────────────────────────────────── */}
      <section id="catalog" className="catalog-section" ref={catalogRef}>
        <div className="catalog-container">

          <RevealSection className="catalog-header-wrap">
            <div className="catalog-header">
              <div className="catalog-header-left">
                <h2>The Rental Fleet</h2>
                <p className="catalog-subtitle">
                  {equipment.length} pieces of precision cinema equipment,
                  available for delivery across Delhi NCR.
                </p>
              </div>
              <div className="category-tabs" role="tablist" aria-label="Equipment categories">
                {['', ...categories].map((cat) => (
                  <button
                    key={cat || '__all__'}
                    className={`cat-tab ${categoryFilter === cat ? 'active' : ''}`}
                    onClick={() => setCategoryFilter(cat)}
                    role="tab"
                    aria-selected={categoryFilter === cat}
                  >
                    {cat || 'All Gear'}
                  </button>
                ))}
              </div>
            </div>
          </RevealSection>

          {loading ? (
            <div className="catalog-loader" aria-live="polite">
              <div className="catalog-spinner">
                <Aperture size={32} className="spinner-icon" />
              </div>
              <span>Loading the fleet…</span>
            </div>
          ) : error ? (
            <div className="catalog-error" role="alert">{error}</div>
          ) : sorted.length === 0 ? (
            <div className="catalog-empty">No equipment available matching this selection.</div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={categoryFilter}
                className="catalog-grid"
                variants={gridContainerVariants}
                initial="hidden"
                animate={catalogInView ? 'visible' : 'hidden'}
              >
                {sorted.map((item) => {
                  const isAvailable = item.status === 'AVAILABLE';
                  return (
                    <motion.div
                      key={item.id}
                      className={`catalog-item-card ${!isAvailable ? 'catalog-item-card--unavailable' : ''}`}
                      variants={cardVariants}
                      whileHover={isAvailable ? { scale: 1.02, y: -4 } : {}}
                      onHoverStart={() => setHoveredCard(item.id)}
                      onHoverEnd={() => setHoveredCard(null)}
                      onClick={() => setSelectedItemForModal(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Image or stub with gradient and icon */}
                      <div className="item-card-image-stub">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="item-stub-image" />
                        ) : (
                          <div className="item-stub-gradient">
                            <CategoryIcon category={item.category} size={44} />
                          </div>
                        )}
                        {/* Status badge */}
                        <span className={`item-badge item-badge--${isAvailable ? 'available' : 'unavailable'}`}>
                          {isAvailable ? '● Available' : '● Unavailable'}
                        </span>
                      </div>

                      <div className="item-card-details">
                        <span className="item-category">{item.category}</span>
                        <h3 className="item-name">{item.name}</h3>
                        <p className="item-meta">
                          {item.brand}{item.model_number ? ` · ${item.model_number}` : ''}
                        </p>
                        {item.description && (
                          <p className="item-desc">{item.description}</p>
                        )}
                        <div className="item-card-footer">
                          <div className="item-price">
                            <span className="price-label">Daily rate</span>
                            <span className="price-val">
                              ₹{parseFloat(item.rental_rate_per_day).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate('/login'); }}
                            className={`item-book-btn ${!isAvailable ? 'item-book-btn--disabled' : ''}`}
                            disabled={!isAvailable}
                          >
                            {isAvailable ? 'View Details' : 'Unavailable'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-top">
            <div className="footer-brand">
              <span className="footer-logo">SD</span>
              <h3>SD DIGITALS</h3>
              <p>Premium Cinema Rentals & Production Services</p>
            </div>
            <div className="footer-links-group">
              <h4>Quick Links</h4>
              <Link to="/login">Client Portal</Link>
            </div>
            <div className="footer-links-group">
              <h4>Legal & Info</h4>
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
            <p>
              © {new Date().getFullYear()} SD Digitals. All rights reserved.
              All rentals are subject to standard verification & damage policies.
            </p>
          </div>
        </div>
      </footer>

      <ChatWidget />
      {selectedItemForModal && (
        <EquipmentDetailModal 
          item={selectedItemForModal} 
          onClose={() => setSelectedItemForModal(null)} 
        />
      )}
    </div>
  );
}
