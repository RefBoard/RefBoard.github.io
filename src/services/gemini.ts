/**
 * Get access token from Session Storage (synced with googleIdentity)
 */
function getAccessToken(): string | null {
    return sessionStorage.getItem('google_access_token');
}

export interface GenerationConfig {
    model: string;
    resolution: string;
    aspectRatio: string;
}

export interface GenerationPayload {
    prompt: string;
    images: Record<string, { id: string, src: string }>;
    config: GenerationConfig;
}

/**
 * Map internal model names to API models
 */
function mapModelName(model: string): string {
    switch (model) {
        case 'gemini-3-pro-image-preview': return 'gemini-3-pro-image-preview'; // "NanoBanana Pro" (Direct)
        case 'gemini-3.0': return 'gemini-3-pro-image-preview'; // "NanoBanana Pro" (Legacy)
        case 'gemini-2.5': return 'gemini-2.5-flash-image'; // "NanoBanana"
        default: return 'gemini-2.5-flash-image';
    }
}

/**
 * Call Gemini API
 */
export async function generateContent(payload: GenerationPayload): Promise<any> {
    const apiKey = localStorage.getItem('gemini_api_key');
    const token = getAccessToken();

    if (!apiKey && !token) {
        throw new Error("No Credential found. Please add a Gemini API Key in settings or Sign In.");
    }

    const apiModel = mapModelName(payload.config.model);

    // Using Generative Language API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent`;

    // Construct parts
    const parts: any[] = [];

    // Add text prompt
    if (payload.prompt) {
        parts.push({ text: payload.prompt });
    }

    // Add images if provided
    if (payload.images && Object.keys(payload.images).length > 0) {
        for (const imageData of Object.values(payload.images)) {
            const img = imageData as { id: string, src: string };
            if (img.src) {
                // Handle base64 data URLs
                if (img.src.startsWith('data:')) {
                    const match = img.src.match(/data:([^;]+);base64,(.+)/);
                    if (match) {
                        parts.push({
                            inline_data: {
                                mime_type: match[1],
                                data: match[2]
                            }
                        });
                    }
                } else if (img.src.startsWith('http')) {
                    // Handle URLs (fetch and convert to base64)
                    // For now, skip URLs - would need CORS-enabled endpoint
                    console.warn('URL images not yet supported, skipping:', img.src);
                }
            }
        }
    }

    // Map resolution to image_size format (1k -> 1K, 2k -> 2K, 4k -> 4K)
    const mapResolutionToImageSize = (resolution: string): string => {
        const upper = resolution.toUpperCase();
        // Ensure it ends with 'K' if it's a number followed by 'k'
        if (upper.endsWith('K')) {
            return upper;
        }
        return upper + 'K';
    };

    // Check if the model supports image_config
    // gemini-3-pro-image-preview supports image_config, but gemini-2.5-flash-image may not
    const supportsImageConfig = apiModel === 'gemini-3-pro-image-preview';

    const body: any = {
        contents: [{ parts }],
        generation_config: {
            response_modalities: supportsImageConfig ? ['TEXT', 'IMAGE'] : ['IMAGE']
        }
    };

    // Only add image_config for models that support it (Pro model)
    if (supportsImageConfig) {
        body.generation_config.image_config = {
            aspect_ratio: payload.config.aspectRatio,
            image_size: mapResolutionToImageSize(payload.config.resolution)
        };
        // Add tools for Pro model
        body.tools = [{ google_search: {} }];
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    let fetchUrl = url;

    if (apiKey) {
        // Use API Key
        fetchUrl = `${url}?key=${apiKey}`;
    } else if (token) {
        // Use OAuth Token
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(fetchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        if (response.status === 403) {
            // Token likely lacks scopes or is invalid for this API
            sessionStorage.removeItem('google_access_token');
            throw new Error("❌ Generation Failed: No API Key found.\n\n📌 Click the GEAR ICON (⚙️) on the generator node to add your Gemini API Key.\n\nGet a free key: https://aistudio.google.com/app/apikey");
        }
        if (response.status === 503) {
            // Service Unavailable - Gemini API server is temporarily overloaded
            throw new Error("⏱️ Gemini 서버가 일시적으로 사용 불가능합니다.\n\n몇 초 기다렸다가 다시 시도해주세요.");
        }
        const errorText = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
    }

    return response.json();
}
