// Cache for Google Fonts list
let cachedFonts: string[] = [];
let fetchPromise: Promise<string[]> | null = null;

/**
 * Fetch all Google Fonts from the API
 */
async function fetchGoogleFonts(): Promise<string[]> {
    try {
        // Using Google Fonts Developer API without key (public endpoint)
        // This will return a list of all available Google Fonts
        const response = await fetch('https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity');
        const data = await response.json();

        if (data.items && Array.isArray(data.items)) {
            return data.items.map((font: any) => font.family);
        }

        // Fallback to popular fonts if API fails
        return getFallbackFonts();
    } catch (error) {
        console.error('Failed to fetch Google Fonts:', error);
        return getFallbackFonts();
    }
}

/**
 * Get cached fonts or fetch if not cached
 */
export async function getGoogleFonts(): Promise<string[]> {
    if (cachedFonts.length > 0) {
        return cachedFonts;
    }

    if (!fetchPromise) {
        fetchPromise = fetchGoogleFonts();
    }

    cachedFonts = await fetchPromise;
    return cachedFonts;
}

/**
 * Search fonts by query (case-insensitive)
 */
export async function searchFonts(query: string): Promise<string[]> {
    if (!query.trim()) {
        return [];
    }

    const fonts = await getGoogleFonts();
    const lowerQuery = query.toLowerCase();

    return fonts
        .filter(font => font.toLowerCase().includes(lowerQuery))
        .slice(0, 20); // Limit to 20 results for performance
}

/**
 * Fallback fonts if API fails
 */
function getFallbackFonts(): string[] {
    return [
        'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald',
        'Source Sans Pro', 'Slabo 27px', 'Raleway', 'PT Sans', 'Merriweather',
        'Ubuntu', 'Playfair Display', 'Poppins', 'Nunito', 'Mukta',
        'Rubik', 'Work Sans', 'Fira Sans', 'Quicksand', 'Titillium Web',
        // Korean fonts
        'Noto Sans KR', 'Noto Serif KR', 'Black Han Sans', 'Jua', 'Do Hyeon',
        'Gamja Flower', 'Nanum Gothic', 'Nanum Myeongjo', 'Sunflower',
        'Gowun Dodum', 'Gowun Batang', 'BBH Bartle',
    ];
}
