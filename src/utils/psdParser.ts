import { readPsd } from 'ag-psd';

export async function convertPSDToImage(file: File): Promise<string | null> {
    try {
        const arrayBuffer = await file.arrayBuffer();

        // Read the PSD file
        // skipLayerImageData: true speeds up reading if we only need the composite image
        // However, if the composite image is missing, we might need to render layers.
        // For now, let's try reading everything to ensure we get a result.
        const psd = readPsd(arrayBuffer);

        if (!psd.canvas) {
            console.warn('No composite image found in PSD, attempting to render layers is not supported in this simple implementation yet.');
            return null;
        }

        // The canvas element from ag-psd
        const canvas = psd.canvas;

        // Convert to Base64 string with alpha channel preserved
        // PNG format automatically preserves alpha channel
        return canvas.toDataURL('image/png');

    } catch (error) {
        console.error('Error parsing PSD file:', error);
        return null;
    }
}

// Deprecated: kept for compatibility if needed, but redirects to new function
export async function extractPSDThumbnail(file: File): Promise<string | null> {
    return convertPSDToImage(file);
}
