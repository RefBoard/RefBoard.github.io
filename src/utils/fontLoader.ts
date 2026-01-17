interface CustomFont {
    name: string;
    value: string;
}

interface TextItem {
    type: string;
    fontFamily?: string;
}

const CUSTOM_FONTS_KEY = 'customGoogleFonts';

/**
 * Load a Google Font dynamically by injecting a link tag
 * Returns a promise that resolves when the font is loaded or rejects if it fails
 */
export async function loadGoogleFont(fontFamily: string): Promise<boolean> {
    // Extract font name from fontFamily string (e.g., "'Noto Sans KR', sans-serif" → "Noto Sans KR")
    const fontNameMatch = fontFamily.match(/'([^']+)'/);
    const fontName = fontNameMatch ? fontNameMatch[1] : fontFamily;

    // Check if font is already loaded
    const existingLink = document.querySelector(`link[href*="${fontName.replace(/\s/g, '+')}"]`);
    if (existingLink) {
        // console.log(`Font "${fontName}" already loaded`); // COMMENTED OUT TO SUPPRESS WARNING
        return true;
    }

    // Create and inject Google Fonts link
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    // Use simpler Google Fonts API format for better compatibility
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s/g, '+')}:wght@300;400;500;600;700&display=swap`;

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Timeout loading font: ${fontName}`));
        }, 5000); // 5 second timeout

        link.onload = async () => {
            clearTimeout(timeout);

            // Verify the font is actually available
            try {
                // Wait a bit for the font to be registered
                await new Promise(r => setTimeout(r, 100));

                // Check if font is available using FontFaceSet
                const fontLoaded = await document.fonts.load(`16px "${fontName}"`);

                if (fontLoaded && fontLoaded.length > 0) {
                    console.log(`Successfully loaded Google Font: ${fontName}`);
                    resolve(true);
                } else {
                    throw new Error('Font not found in Google Fonts');
                }
            } catch (error) {
                // Font CSS loaded but font family doesn't exist
                document.head.removeChild(link);
                reject(new Error(`Font "${fontName}" not found in Google Fonts`));
            }
        };

        link.onerror = () => {
            clearTimeout(timeout);
            reject(new Error(`Failed to load font CSS: ${fontName}`));
        };

        document.head.appendChild(link);
    });
}

/**
 * Parse all text items and extract unique font families
 */
export function parseUsedFonts(items: TextItem[]): string[] {
    const fonts = new Set<string>();

    items.forEach(item => {
        if (item.type === 'text' && item.fontFamily) {
            fonts.add(item.fontFamily);
        }
    });

    return Array.from(fonts);
}

/**
 * Get custom fonts from localStorage
 */
export function getCustomFonts(): CustomFont[] {
    try {
        const stored = localStorage.getItem(CUSTOM_FONTS_KEY);
        if (!stored) return [];

        const data = JSON.parse(stored);
        return data.fonts || [];
    } catch (error) {
        console.error('Failed to load custom fonts from localStorage:', error);
        return [];
    }
}

/**
 * Add a custom font to localStorage
 */
export function addCustomFont(fontName: string): CustomFont {
    const fonts = getCustomFonts();

    // Check if font already exists
    const existingFont = fonts.find(f => f.name === fontName);
    if (existingFont) {
        return existingFont;
    }

    // Create new font entry
    const newFont: CustomFont = {
        name: fontName,
        value: `'${fontName}', sans-serif`
    };

    fonts.push(newFont);

    // Save to localStorage
    try {
        localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify({ fonts }));
        console.log(`Added custom font: ${fontName}`);
    } catch (error) {
        console.error('Failed to save custom font:', error);
    }

    return newFont;
}

/**
 * Remove a custom font from localStorage
 */
export function removeCustomFont(fontName: string): void {
    const fonts = getCustomFonts().filter(f => f.name !== fontName);

    try {
        localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify({ fonts }));
        console.log(`Removed custom font: ${fontName}`);
    } catch (error) {
        console.error('Failed to remove custom font:', error);
    }
}

/**
 * Auto-load all fonts used in the current board
 */
export async function autoLoadBoardFonts(items: TextItem[]): Promise<void> {
    const usedFonts = parseUsedFonts(items);

    // Load fonts in parallel but don't fail if one font fails
    await Promise.allSettled(
        usedFonts.map(async fontFamily => {
            try {
                await loadGoogleFont(fontFamily);
            } catch (error) {
                console.warn(`Failed to load font ${fontFamily}:`, error);
            }
        })
    );
}
