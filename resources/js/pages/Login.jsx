import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/layout/BrandLogo';
import { useApp } from '../context/AppContext';

export const Login = ({ portal = 'internal' }) => {
    const { login, actionError } = useApp();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [localError, setLocalError] = useState('');
    const isVendor = portal === 'vendor';

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLocalError('');
        setSubmitting(true);
        try {
            await login(email, password, portal);
        } catch (error) {
            setLocalError(error.message || 'Unable to sign in.');
        } finally {
            setSubmitting(false);
        }
    };

    const form = (
        <div className="login-card">
            <div className="login-brand">
                <BrandLogo
                    variant="login"
                    subtitle={isVendor ? 'Vendor Portal' : 'Supply Chain'}
                />
            </div>

            <h2 className="page-title">{isVendor ? 'Welcome back' : 'Sign in'}</h2>
            <p className="page-description">
                {isVendor
                    ? 'Submit quotations, track RFQs, and confirm purchase orders.'
                    : 'Manage inventory, procurement, and warehouse operations.'}
            </p>

            {(localError || actionError) && (
                <div className="login-error">
                    <p className="text-xs font-bold">{localError || actionError}</p>
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label" htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        className="form-control"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="username"
                        required
                    />
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        className="form-control"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        required
                    />
                </div>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Signing in...' : 'Sign in'}
                </button>
            </form>

            <p className="login-switch">
                {isVendor ? (
                    <>
                        Supply chain staff?{' '}
                        <Link to="/" className="text-blue font-bold">Sign in here</Link>
                    </>
                ) : (
                    <>
                        Vendor?{' '}
                        <Link to="/vendor" className="text-blue font-bold">Open Vendor Portal</Link>
                    </>
                )}
            </p>
        </div>
    );

    if (isVendor) {
        return <div className="login-screen">{form}</div>;
    }

    return (
        <div className="login-screen login-screen-inventory">
            <aside className="login-hero">
                <div className="login-hero-brand">
                    <BrandLogo variant="hero" subtitle="Supply Chain & Inventory" />
                </div>

                <div className="login-hero-copy">
                    <span className="login-hero-badge">Inventory Portal</span>
                    <h1>Stock, procurement, and warehouse in one dashboard.</h1>
                    <p>Verify department requests, track purchase orders, and keep fleet supplies ready from a single secure login.</p>
                </div>
            </aside>
            <div className="login-panel">
                {form}
            </div>
        </div>
    );
};
