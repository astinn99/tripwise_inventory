import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Store } from 'lucide-react';
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
            await login(email, password);
        } catch (error) {
            setLocalError(error.message || 'Unable to sign in.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="login-screen">
            <div className="login-card">
                <div className="login-brand">
                    <span className="brand-logo-icon">
                        {isVendor ? <Store className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                    </span>
                    <div>
                        <span className="login-brand-title">TRIPWISE</span>
                        <span className="login-brand-sub">{isVendor ? 'Vendor Portal' : 'Supply Chain'}</span>
                    </div>
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
        </div>
    );
};
