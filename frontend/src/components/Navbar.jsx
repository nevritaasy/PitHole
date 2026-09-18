import React from 'react';

export default function Navbar({ onResetToHome, onAdminClick }) {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand-section" onClick={onResetToHome}>
          <div className="brand-logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="currentColor" opacity="0.3" />
            </svg>
          </div>
          <div>
            <h1 className="brand-title">PitHoles</h1>
            <p className="brand-subtitle">Peta Sebaran Jalan Berlubang di Area UGM</p>
          </div>
        </div>

        <button className="btn-admin-login" onClick={onAdminClick}>
          Login Untuk Admin
        </button>
      </div>
    </header>
  );
}
