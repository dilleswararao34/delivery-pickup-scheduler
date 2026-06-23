import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './InfoPages.css';

export default function TermsOfService() {
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
        <h1 className="info-title">Terms of Service</h1>
        <p className="info-date">Last Updated: June 22, 2026</p>

        <section className="info-section">
          <h2>1. Rental Agreement</h2>
          <p>
            By booking equipment from SD Digitals, you agree to these Terms of Service. All rentals are subject to validation, availability checks, and security deposit approval.
          </p>
        </section>

        <section className="info-section">
          <h2>2. Verification & Deposits</h2>
          <p>
            All clients must provide valid identification and company details. SD Digitals holds a security deposit (typically 10% of the equipment value) through our secure payment gateway. Deposits are fully refunded within 24-48 hours after gear is returned undamaged to our depot.
          </p>
        </section>

        <section className="info-section">
          <h2>3. Cancellation Policy</h2>
          <p>
            Cancellations requested more than 24 hours prior to the scheduled delivery date are processed immediately with a full refund of the rental fee and deposit.
            Cancellations requested within 24 hours of scheduled delivery require administrative review and are subject to a cancellation fee of up to 50% of the daily rental rate.
          </p>
        </section>

        <section className="info-section">
          <h2>4. Damaged or Lost Equipment</h2>
          <p>
            The renter is fully responsible for any loss, theft, or damage to the equipment during the rental period. Damage reports must be logged immediately. Any repair or replacement costs will be deducted from the security deposit or billed separately.
          </p>
        </section>

        <section className="info-section">
          <h2>5. Late Returns</h2>
          <p>
            Late returns will incur additional rental fees at the standard daily rate, plus a surcharge if the return delay conflicts with subsequent bookings.
          </p>
        </section>
      </main>

      <footer className="info-footer">
        <p>&copy; {new Date().getFullYear()} SD Digitals. Premium Cinema Rentals NCR.</p>
      </footer>
    </div>
  );
}
