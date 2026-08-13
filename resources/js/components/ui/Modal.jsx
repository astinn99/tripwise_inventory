import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const SIZE_CLASS = {
    sm: 'modal-size-sm',
    md: 'modal-size-md',
    lg: 'modal-size-lg',
    xl: 'modal-size-xl',
};

export function displayValue(value, fallback = '—') {
    if (value === 0 || value === '0') {
        return value;
    }

    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    return value;
}

export function Modal({
    open = true,
    onClose,
    title,
    subtitle,
    icon: Icon,
    tone = 'rose',
    size = 'md',
    footer,
    children,
    asForm = false,
    onSubmit,
}) {
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose?.();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    if (!open) {
        return null;
    }

    const handleOverlayMouseDown = (event) => {
        if (event.target === event.currentTarget) {
            onClose?.();
        }
    };

    const content = (
        <>
            <div className="modal-header">
                <div className="modal-title">
                    {Icon ? (
                        <span className={`modal-icon modal-icon-${tone}`}>
                            <Icon />
                        </span>
                    ) : null}
                    <div className="modal-heading">
                        <h3>{title}</h3>
                        {subtitle ? <p>{subtitle}</p> : null}
                    </div>
                </div>
                <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
                    <X />
                </button>
            </div>
            <div className="modal-body">{children}</div>
            {footer ? <div className="modal-footer">{footer}</div> : null}
        </>
    );

    const shellClass = `modal-container ${SIZE_CLASS[size] || SIZE_CLASS.md}`;

    return (
        <div className="modal-overlay" onMouseDown={handleOverlayMouseDown}>
            {asForm ? (
                <form className={shellClass} onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
                    {content}
                </form>
            ) : (
                <div className={shellClass} onMouseDown={(event) => event.stopPropagation()}>
                    {content}
                </div>
            )}
        </div>
    );
}
