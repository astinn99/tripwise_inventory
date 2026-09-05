import React, { useState } from 'react';
import { EmailOtpForm } from '../components/ui/EmailOtpForm';
import { BrandLogo } from '../components/layout/BrandLogo';
import { useApp } from '../context/AppContext';
import { api, ApiError } from '../services/api';
import { normalizeOtpChallenge } from '../services/otp';
import { VendorRegister } from './VendorRegister';

export const Login = ({ portal = 'internal' }) => {
    const { login, verifyLoginOtp, resendLoginOtp, acceptSession, actionError } = useApp();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [localError, setLocalError] = useState('');
    const [view, setView] = useState('login');
    const [step, setStep] = useState('password');
    const [challenge, setChallenge] = useState(null);
    const [registeredEmail, setRegisteredEmail] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [registerAwaitingOtp, setRegisterAwaitingOtp] = useState(false);
    const isVendor = portal === 'vendor';

    const resetChallenge = () => {
        setStep('password');
        setChallenge(null);
        setLocalError('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLocalError('');
        setInfoMessage('');
        setSubmitting(true);
        try {
            const result = normalizeOtpChallenge(await login(email.trim(), password, portal));
            if (result?.requiresEmailVerification) {
                setChallenge(result);
                setStep('verify-email');
                return;
            }
            if (result?.requiresOtp || result?.challengeId) {
                setChallenge(result);
                setStep('otp');
            }
        } catch (error) {
            setLocalError(error.message || 'Unable to sign in.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleLoginOtp = async (code) => {
        setLocalError('');
        setSubmitting(true);
        try {
            await verifyLoginOtp(challenge.challengeId, code, portal);
        } catch (error) {
            setLocalError(error.message || 'Unable to verify that code.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerifyEmail = async (code) => {
        setLocalError('');
        setSubmitting(true);
        try {
            const payload = await api.post('/api/vendor/register/verify', {
                challengeId: challenge.challengeId,
                code,
            }, { portal: 'vendor' });
            if (payload?.token) {
                acceptSession(payload, 'vendor');
                return;
            }
            setRegisteredEmail(email.trim());
            setInfoMessage('Email verified. Sign in to continue.');
            resetChallenge();
        } catch (error) {
            setLocalError(error instanceof ApiError ? error.message : 'Unable to verify that code.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResendLogin = () => resendLoginOtp(challenge.challengeId, portal);

    const handleResendRegister = () => api.post('/api/vendor/register/resend', {
        challengeId: challenge.challengeId,
    }, { portal: 'vendor' });

    const otpCard = (
        <div className="login-card">
            <div className="login-brand">
                <BrandLogo
                    variant="login"
                    subtitle={isVendor ? 'Vendor Portal' : 'Supply Chain'}
                />
            </div>
            <EmailOtpForm
                title={step === 'verify-email' ? 'Verify your email' : 'Check your email'}
                description={
                    step === 'verify-email'
                        ? 'We sent a verification code to your registered address'
                        : 'We sent a sign-in code to your registered address'
                }
                emailMasked={challenge?.emailMasked}
                submitting={submitting}
                error={localError || actionError}
                resendIn={challenge?.resendIn ?? 60}
                submitLabel={step === 'verify-email' ? 'Verify email' : 'Verify and sign in'}
                onSubmit={step === 'verify-email' ? handleVerifyEmail : handleLoginOtp}
                onResend={step === 'verify-email' ? handleResendRegister : handleResendLogin}
                onBack={resetChallenge}
                backLabel="Back to sign in"
            />
        </div>
    );

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

            {infoMessage || (registeredEmail && isVendor) ? (
                <div className="login-success">
                    <p className="text-xs font-bold">
                        {infoMessage || `Email verified for ${registeredEmail}. Sign in while supply chain reviews your credentials.`}
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

    const card = step === 'password' ? form : otpCard;

    if (isVendor) {
        if (view === 'register') {
            return (
                <div className={`login-screen login-screen-vendor${registerAwaitingOtp ? '' : ' login-screen-vendor-register'}`}>
                    <aside className="login-hero">
                        <div className="login-hero-brand">
                            <BrandLogo variant="hero" />
                        </div>
                    </aside>
                    <div className="login-panel">
                        <VendorRegister
                            onCancel={() => {
                                setRegisterAwaitingOtp(false);
                                setView('login');
                            }}
                            onAwaitingOtp={setRegisterAwaitingOtp}
                            onRegistered={(nextEmail) => {
                                setRegisteredEmail(nextEmail);
                                setEmail(nextEmail);
                                setLocalError('');
                                setInfoMessage('');
                                setRegisterAwaitingOtp(false);
                                resetChallenge();
                                setView('login');
                            }}
                        />
                    </div>
                </div>
            );
        }

        return (
            <div className="login-screen login-screen-vendor">
                <aside className="login-hero">
                    <div className="login-hero-brand">
                        <BrandLogo variant="hero" />
                    </div>
                </aside>
                <div className="login-panel">
                    {card}
                </div>
            </div>
        );
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
                {card}
            </div>
        </div>
    );
};
