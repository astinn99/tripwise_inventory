import React from 'react';

export const BrandLogo = ({ subtitle, variant = 'sidebar' }) => (
  <div className={`brand-lockup brand-lockup-${variant}`}>
    <span
      className="brand-wordmark"
      aria-label="TripWise."
      style={{ textTransform: 'none' }}
    >
      TripWise<span className="brand-period" style={{ color: '#E11D48', textTransform: 'none' }}>.</span>
    </span>
    {subtitle ? <span className="brand-sub">{subtitle}</span> : null}
  </div>
);
