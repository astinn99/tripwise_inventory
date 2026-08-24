const MAX_EDGE = 1280;
const TARGET_BYTES = 400 * 1024;
const QUALITY_STEPS = [0.82, 0.7, 0.55, 0.4, 0.28, 0.18];
const SCALE_STEPS = [1, 0.75, 0.55, 0.4];

const canRescale = () => (
    typeof document !== 'undefined'
    && typeof createImageBitmap === 'function'
    && typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.toBlob === 'function'
);

const jpegName = (name) => `${String(name || 'photo').replace(/\.[^.]+$/, '')}.jpg`;

const encode = (canvas, quality) => new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
});

const drawScaled = (source, width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const context = canvas.getContext('2d');
    if (!context) {
        return null;
    }
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
};

/**
 * Phone photos routinely exceed PHP's `upload_max_filesize`, which rejects the file
 * before any application validation runs. Shrinking in the browser keeps uploads
 * inside that ceiling without asking every deployment to retune php.ini.
 *
 * Returns the original file whenever it is already small enough or cannot be decoded.
 */
export async function compressImageFile(file, options = {}) {
    const maxBytes = options.maxBytes ?? TARGET_BYTES;
    const maxEdge = options.maxEdge ?? MAX_EDGE;

    if (!(file instanceof File) || !file.type.startsWith('image/') || !canRescale()) {
        return file;
    }

    let bitmap;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
        return file;
    }

    const longestEdge = Math.max(bitmap.width, bitmap.height);
    if (longestEdge <= maxEdge && file.size <= maxBytes) {
        bitmap.close?.();
        return file;
    }

    const fit = Math.min(1, maxEdge / longestEdge);
    let smallest = null;

    try {
        for (const scale of SCALE_STEPS) {
            const canvas = drawScaled(bitmap, bitmap.width * fit * scale, bitmap.height * fit * scale);
            if (!canvas) {
                break;
            }

            for (const quality of QUALITY_STEPS) {
                // eslint-disable-next-line no-await-in-loop
                const blob = await encode(canvas, quality);
                if (!blob) {
                    break;
                }
                if (!smallest || blob.size < smallest.size) {
                    smallest = blob;
                }
                if (blob.size <= maxBytes) {
                    smallest = blob;
                    break;
                }
            }

            if (smallest && smallest.size <= maxBytes) {
                break;
            }
        }
    } finally {
        bitmap.close?.();
    }

    if (!smallest || smallest.size >= file.size) {
        return file;
    }

    return new File([smallest], jpegName(file.name), {
        type: 'image/jpeg',
        lastModified: Date.now(),
    });
}

export function formatFileSize(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) {
        return `${size} B`;
    }
    if (size < 1024 * 1024) {
        return `${Math.round(size / 1024)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
