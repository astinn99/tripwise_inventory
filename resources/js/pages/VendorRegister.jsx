import React, { useState } from 'react';
import { BrandLogo } from '../components/layout/BrandLogo';
import { api, ApiError } from '../services/api';

const CATEGORIES = [
    'Office Supplies',
    'Communication Devices',
    'Maintenance Tools',
    'Fleet Consumables',
    'Others',
];

const emptyForm = {
    companyName: '',
    address: '',
    categories: [],
    contactPerson: '',
    phone: '',
    email: '',
    taxId: '',
    secRegistration: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    password: '',
    password_confirmation: '',
    businessPermitExpiresOn: '',
};

const FileField = ({ id, label, hint, file, onChange, accept = '.pdf,.jpg,.jpeg,.png,.webp' }) => (
    <div className="form-group">
        <label className="form-label" htmlFor={id}>{label}</label>
        <input
            id={id}
            type="file"
            className="form-control"
            accept={accept}
            onChange={(event) => onChange(event.target.files?.[0] || null)}
            required
        />
        <p className="item-photo-hint">
            {file ? file.name : hint}
        </p>
    </div>
);

export const VendorRegister = ({ onCancel, onRegistered }) => {
    const [form, setForm] = useState(emptyForm);
    const [permitFile, setPermitFile] = useState(null);
    const [secFile, setSecFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const setField = (key, value) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const toggleCategory = (category) => {
        setForm((current) => {
            const selected = current.categories.includes(category)
                ? current.categories.filter((item) => item !== category)
                : [...current.categories, category];
            return { ...current, categories: selected };
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (form.categories.length === 0) {
            setError('Select at least one supply category you can serve.');
            return;
        }

        if (form.password !== form.password_confirmation) {
            setError('Password confirmation does not match.');
            return;
        }

        if (!permitFile || !secFile) {
            setError('Upload both the business permit and the SEC/DTI certificate.');
            return;
        }

        const payload = new FormData();
        Object.entries(form).forEach(([key, value]) => {
            if (key === 'categories') {
                value.forEach((category) => payload.append('categories[]', category));
                return;
            }
            payload.append(key, value);
        });
        payload.append('businessPermitFile', permitFile);
        payload.append('secCertificateFile', secFile);

        setSubmitting(true);
        try {
            await api.post('/api/vendor/register', payload, { portal: 'vendor', timeout: 60000 });
            onRegistered?.(form.email);
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'Unable to submit registration.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="login-card login-card-register">
            <div className="login-brand">
                <BrandLogo variant="login" subtitle="Vendor Portal" />
            </div>

            <h2 className="page-title">Register your company</h2>
            <p className="page-description">
                Submit legal, contact, and banking details so supply chain can review your vendor account.
            </p>

            {error ? (
                <div className="login-error">
                    <p className="text-xs font-bold">{error}</p>
                </div>
            ) : null}

            <form onSubmit={handleSubmit}>
                <div className="login-section">
                    <div className="login-section-title">Company profile</div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="companyName">Company name</label>
                        <input
                            id="companyName"
                            className="form-control"
                            value={form.companyName}
                            onChange={(event) => setField('companyName', event.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="address">Business address</label>
                        <textarea
                            id="address"
                            className="form-control"
                            rows="2"
                            value={form.address}
                            onChange={(event) => setField('address', event.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <span className="form-label">Categories you can supply</span>
                        <div className="login-check-row">
                            {CATEGORIES.map((category) => (
                                <label key={category} className="login-check">
                                    <input
                                        type="checkbox"
                                        checked={form.categories.includes(category)}
                                        onChange={() => toggleCategory(category)}
                                    />
                                    {category}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="login-section">
                    <div className="login-section-title">Contacts</div>
                    <div className="grid-2">
                        <div className="form-group">
                            <label className="form-label" htmlFor="contactPerson">Contact person</label>
                            <input
                                id="contactPerson"
                                className="form-control"
                                value={form.contactPerson}
                                onChange={(event) => setField('contactPerson', event.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="phone">Phone</label>
                            <input
                                id="phone"
                                className="form-control"
                                value={form.phone}
                                onChange={(event) => setField('phone', event.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="registerEmail">Email (used to sign in)</label>
                        <input
                            id="registerEmail"
                            type="email"
                            className="form-control"
                            value={form.email}
                            onChange={(event) => setField('email', event.target.value)}
                            autoComplete="username"
                            required
                        />
                    </div>
                </div>

                <div className="login-section">
                    <div className="login-section-title">Legal credentials</div>
                    <div className="grid-2">
                        <div className="form-group">
                            <label className="form-label" htmlFor="taxId">TIN</label>
                            <input
                                id="taxId"
                                className="form-control"
                                value={form.taxId}
                                onChange={(event) => setField('taxId', event.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="secRegistration">SEC / DTI number</label>
                            <input
                                id="secRegistration"
                                className="form-control"
                                value={form.secRegistration}
                                onChange={(event) => setField('secRegistration', event.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <FileField
                        id="secCertificateFile"
                        label="SEC / DTI certificate"
                        hint="PDF, JPG, PNG, or WebP up to 10 MB."
                        file={secFile}
                        onChange={setSecFile}
                    />
                    <FileField
                        id="businessPermitFile"
                        label="Business permit"
                        hint="Upload the current mayor's or business permit."
                        file={permitFile}
                        onChange={setPermitFile}
                    />
                    <div className="form-group">
                        <label className="form-label" htmlFor="businessPermitExpiresOn">Permit expiration</label>
                        <input
                            id="businessPermitExpiresOn"
                            type="date"
                            className="form-control"
                            value={form.businessPermitExpiresOn}
                            onChange={(event) => setField('businessPermitExpiresOn', event.target.value)}
                            required
                        />
                    </div>
                </div>

                <div className="login-section">
                    <div className="login-section-title">Bank details</div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="bankName">Bank name</label>
                        <input
                            id="bankName"
                            className="form-control"
                            value={form.bankName}
                            onChange={(event) => setField('bankName', event.target.value)}
                            required
                        />
                    </div>
                    <div className="grid-2">
                        <div className="form-group">
                            <label className="form-label" htmlFor="accountName">Account name</label>
                            <input
                                id="accountName"
                                className="form-control"
                                value={form.accountName}
                                onChange={(event) => setField('accountName', event.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="accountNumber">Account number</label>
                            <input
                                id="accountNumber"
                                className="form-control"
                                value={form.accountNumber}
                                onChange={(event) => setField('accountNumber', event.target.value)}
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="login-section">
                    <div className="login-section-title">Portal password</div>
                    <div className="grid-2">
                        <div className="form-group">
                            <label className="form-label" htmlFor="registerPassword">Password</label>
                            <input
                                id="registerPassword"
                                type="password"
                                className="form-control"
                                value={form.password}
                                onChange={(event) => setField('password', event.target.value)}
                                autoComplete="new-password"
                                minLength={8}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="registerPasswordConfirm">Confirm password</label>
                            <input
                                id="registerPasswordConfirm"
                                type="password"
                                className="form-control"
                                value={form.password_confirmation}
                                onChange={(event) => setField('password_confirmation', event.target.value)}
                                autoComplete="new-password"
                                minLength={8}
                                required
                            />
                        </div>
                    </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit registration'}
                </button>
            </form>

            <p className="login-footer">
                Already registered?{' '}
                <button type="button" className="login-text-link" onClick={onCancel}>
                    Sign in
                </button>
            </p>
        </div>
    );
};
