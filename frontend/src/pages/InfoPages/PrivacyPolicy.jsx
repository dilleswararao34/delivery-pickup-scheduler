import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './InfoPages.css';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="info-page">
      <header className="info-header">
        <div className="info-header-container">
          <Link to="/" className="info-logo-group">
            <span className="logo-badge">SD</span>
            <span className="logo-text">SD DIGITALS</span>
          </Link>
          <button onClick={() => navigate(-1)} className="back-btn">
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </header>

      <main className="info-content-container">
        <h1 className="info-title">Privacy Policy</h1>
        <p className="info-date">Last Updated: June 22, 2026</p>

        <section className="info-section">
          <h2>1. Information We Collect</h2>
          <p>
            We collect personal details such as your name, email address, phone number, and billing information to process your cinema equipment bookings.
          </p>
        </section>

        <section className="info-section">
          <h2>2. How We Use Your Data</h2>
          <p>
            Your information is used solely to manage bookings, coordinate logistics deliveries, process secure Razorpay payments, and dispatch notifications regarding status updates or system confirmations.
          </p>
        </section>

        <section className="info-section">
          <h2>3. Security</h2>
          <p>
            All connection data is encrypted via SSL/TLS. Sensitive financial details and card information are processed directly by our payment partner Razorpay and are never stored on our local servers.
          </p>
        </section>

        <section className="info-section">
          <h2>4. Third-Party Sharing</h2>
          <p>
            We do not sell, trade, or share your personal data with third parties, except as necessary to fulfill delivery logistics or comply with legal requirements.
          </p>
        </section>
      </main>

      <footer className="info-footer">
        <p>&copy; {new Date().getFullYear()} SD Digitals. Premium Cinema Rentals NCR.</p>
      </footer>
    </div>
  );
}
