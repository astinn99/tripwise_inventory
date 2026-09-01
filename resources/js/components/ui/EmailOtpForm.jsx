import React, { useEffect, useRef, useState } from 'react';

const OTP_LENGTH = 6;

const emptyDigits = () => Array.from({ length: OTP_LENGTH }, () => '');

export const EmailOtpForm = ({
    title,
    description,
    emailMasked,
    submitting,
    error,
    resendIn = 60,
    submitLabel = 'Verify code',
    onSubmit,
    onResend,
    onBack,
    backLabel = 'Use a different account',
}) => {
    const [digits, setDigits] = useState(emptyDigits);
    const [cooldown, setCooldown] = useState(resendIn);
    const [resending, setResending] = useState(false);
    const inputsRef = useRef([]);
    const submittedRef = useRef('');

    const code = digits.join('');

    useEffect(() => {
        setCooldown(resendIn);
    }, [resendIn]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setCooldown((current) => (current > 0 ? current - 1 : 0));
        }, 1000);

        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        inputsRef.current[0]?.focus();
    }, []);

    useEffect(() => {
        submittedRef.current = '';
    }, [error]);

    const focusAt = (index) => {
        const input = inputsRef.current[Math.max(0, Math.min(index, OTP_LENGTH - 1))];
        input?.focus();
        input?.select();
    };

    const applyCode = (value, start = 0) => {
        const chars = value.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
        setDigits((current) => {
            const next = [...current];
            if (start === 0 && chars.length === OTP_LENGTH) {
                return [...chars, ...emptyDigits()].slice(0, OTP_LENGTH);
            }
            chars.forEach((char, offset) => {
                if (start + offset < OTP_LENGTH) {
                    next[start + offset] = char;
                }
            });
            return next;
        });
        focusAt(Math.min(start + Math.max(chars.length, 1) - (chars.length ? 0 : 1), OTP_LENGTH - 1));
    };

    const handleChange = (index, value) => {
        const cleaned = value.replace(/\D/g, '');
        if (!cleaned) {
            setDigits((current) => {
                const next = [...current];
                next[index] = '';
                return next;
            });
            return;
        }

        if (cleaned.length > 1) {
            applyCode(cleaned, 0);
            return;
        }

        setDigits((current) => {
            const next = [...current];
            next[index] = cleaned;
            return next;
        });
        if (index < OTP_LENGTH - 1) {
            focusAt(index + 1);
        }
    };

    const handleKeyDown = (index, event) => {
        if (event.key === 'Backspace') {
            event.preventDefault();
            setDigits((current) => {
                const next = [...current];
                if (next[index]) {
                    next[index] = '';
                    return next;
                }
                if (index > 0) {
                    next[index - 1] = '';
                    focusAt(index - 1);
                }
                return next;
            });
            return;
        }

        if (event.key === 'ArrowLeft' && index > 0) {
            event.preventDefault();
            focusAt(index - 1);
        }

        if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
            event.preventDefault();
            focusAt(index + 1);
        }
    };

    const handlePaste = (event) => {
        event.preventDefault();
        applyCode(event.clipboardData.getData('text'), 0);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const next = code.replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (next.length !== OTP_LENGTH || submitting) {
            return;
        }
        submittedRef.current = next;
        await onSubmit(next);
    };

    const handleResend = async () => {
        if (cooldown > 0 || resending) {
            return;
        }

        setResending(true);
        try {
            const next = await onResend();
            setDigits(emptyDigits());
            submittedRef.current = '';
            setCooldown(next?.resendIn ?? resendIn);
            focusAt(0);
        } finally {
            setResending(false);
        }
    };

    return (
        <>
            <h2 className="page-title">{title}</h2>
            <p className="page-description">
                {description}{' '}
                {emailMasked ? <strong>{emailMasked}</strong> : null}
            </p>

            {error ? (
                <div className="login-error">
                    <p className="text-xs font-bold">{error}</p>
                </div>
            ) : null}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label" id="otpCodeLabel">6-digit code</label>
                    <div
                        className="otp-boxes"
                        role="group"
                        aria-labelledby="otpCodeLabel"
                        onPaste={handlePaste}
                    >
                        {digits.map((digit, index) => (
                            <input
                                key={index}
                                ref={(node) => {
                                    inputsRef.current[index] = node;
                                }}
                                id={index === 0 ? 'otpCode' : undefined}
                                className={`otp-box${digit ? ' is-filled' : ''}${error ? ' is-error' : ''}`}
                                type="text"
                                inputMode="numeric"
                                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                                aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                                maxLength={index === 0 ? OTP_LENGTH : 1}
                                value={digit}
                                onChange={(event) => handleChange(index, event.target.value)}
                                onKeyDown={(event) => handleKeyDown(index, event)}
                                onFocus={(event) => event.target.select()}
                                disabled={submitting}
                            />
                        ))}
                    </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={submitting || code.length !== OTP_LENGTH}>
                    {submitting ? 'Checking...' : submitLabel}
                </button>
            </form>

            <p className="login-footer">
                {cooldown > 0 ? (
                    <span>Resend available in {cooldown}s</span>
                ) : (
                    <button type="button" className="login-text-link" onClick={handleResend} disabled={resending}>
                        {resending ? 'Sending...' : 'Resend code'}
                    </button>
                )}
                {onBack ? (
                    <>
                        {' · '}
                        <button type="button" className="login-text-link" onClick={onBack}>
                            {backLabel}
                        </button>
                    </>
                ) : null}
            </p>
        </>
    );
};
