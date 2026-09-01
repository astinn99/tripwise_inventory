<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $purpose === 'register' ? 'Verify your email' : 'Your sign-in code' }}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;">
                    <tr>
                        <td>
                            <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">
                                {{ config('app.name') }}
                            </p>
                            <h1 style="margin:0 0 16px;font-size:22px;">
                                {{ $purpose === 'register' ? 'Verify your email' : 'Your sign-in code' }}
                            </h1>
                            <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#334155;">
                                Hi {{ $user->name }}, use this code for the
                                {{ $purpose === 'register' ? 'email address on your vendor registration' : 'account you are signing in to' }}.
                                It expires in {{ (int) config('otp.ttl_minutes') }} minutes.
                            </p>
                            <p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:0.28em;text-align:center;">
                                {{ $code }}
                            </p>
                            <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">
                                This code was sent only to {{ $user->email }}. If you did not request it, you can ignore this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
