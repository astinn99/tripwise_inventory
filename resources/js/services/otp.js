export function normalizeOtpChallenge(payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const requiresOtp = Boolean(payload.requiresOtp ?? payload.requires_otp);
    const requiresEmailVerification = Boolean(
        payload.requiresEmailVerification ?? payload.requires_email_verification,
    );
    const challengeId = payload.challengeId ?? payload.challenge_id;

    if (!requiresOtp && !requiresEmailVerification && !(challengeId && !payload.token)) {
        return null;
    }

    return {
        ...payload,
        requiresOtp,
        requiresEmailVerification,
        challengeId,
        emailMasked: payload.emailMasked ?? payload.email_masked ?? '',
        resendIn: payload.resendIn ?? payload.resend_in ?? 60,
    };
}
