import React, { useState } from 'react';
import { BrandLogo } from '../components/layout/BrandLogo';
import { useApp } from '../context/AppContext';
import { VendorRegister } from './VendorRegister';

export const Login = ({ portal = 'internal' }) => {
    const { login, actionError } = useApp();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [localError, setLocalError] = useState('');
    const [view, setView] = useState('login');
    const [registeredEmail, setRegisteredEmail] = useState('');
    const isVendor = portal === 'vendor';

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLocalError('');
        setSubmitting(true);
        try {
            await login(email.trim(), password, portal);
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

            {registeredEmail && isVendor ? (
                <div className="login-success">
                    <p className="text-xs font-bold">
                        Registration submitted for {registeredEmail}. You can sign in while supply chain reviews your credentials.
                    </p>
                </div>
            ) : null}

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

            {isVendor ? (
                <p className="login-footer">
                    New vendor?{' '}
                    <button type="button" className="login-text-link" onClick={() => setView('register')}>
                        Register your company
                    </button>
                </p>
            ) : null}
        </div>
    );

    if (isVendor) {
        if (view === 'register') {
            return (
                <div className="login-screen login-screen-register">
                    <VendorRegister
                        onCancel={() => setView('login')}
                        onRegistered={(nextEmail) => {
                            setRegisteredEmail(nextEmail);
                            setEmail(nextEmail);
                            setLocalError('');
                            setView('login');
                        }}
                    />
                </div>
            );
        }

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
