
import React from 'react';

interface LandingPageProps {
    onGetStarted: () => void;
    onDownload: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onDownload }) => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white font-sans overflow-y-auto">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {/* Logo Icon */}
                        <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            RefBoard
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onGetStarted}
                            className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
                        >
                            Log In
                        </button>
                        <button
                            onClick={onDownload}
                            className="bg-white text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-gray-100 transition-transform active:scale-95"
                        >
                            Download App
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="pt-32 pb-20 px-6 relative overflow-hidden">
                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                        <span className="text-blue-400 text-sm font-medium">✨ Since 2024</span>
                        <span className="mx-2 text-gray-500">|</span>
                        <span className="text-gray-300 text-sm">The Ultimate Reference Workspace</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
                        Organize Your <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                            Creative Vision
                        </span>
                    </h1>
                    <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                        RefBoard is the endless digital canvas for creators, designers, and developers.
                        Gather references, brainstorm ideas, and collaborate in real-time.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={onGetStarted}
                            className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-1"
                        >
                            Open Web App
                        </button>
                        <button
                            onClick={onDownload}
                            className="w-full sm:w-auto px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold text-lg border border-white/10 transition-all hover:-translate-y-1"
                        >
                            Download Client
                        </button>
                    </div>
                </div>

                {/* Background Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
            </header>

            {/* Features Grid */}
            <section className="py-20 bg-black/20">
                <div className="max-w-6xl mx-auto px-6">
                    <h2 className="text-3xl font-bold text-center mb-16">Why RefBoard?</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon="🎨"
                            title="Infinite Canvas"
                            description="No boundaries. Place images, notes, and videos anywhere on an infinitely expandable workspace."
                        />
                        <FeatureCard
                            icon="⚡"
                            title="Real-time Sync"
                            description="Collaborate with your team instantly. Changes are synchronized across all devices in real-time."
                        />
                        <FeatureCard
                            icon="🔒"
                            title="Secure & Private"
                            description="Your boards are private by default. Share only what you want with granular permission controls."
                        />
                        <FeatureCard
                            icon="📂"
                            title="Drag & Drop"
                            description="Simply drag images from your desktop or browser directly onto the board. It's that easy."
                        />
                        <FeatureCard
                            icon="🎯"
                            title="Smart Organization"
                            description="Group items, create frames, and use auto-layout tools to keep your creative chaos organized."
                        />
                        <FeatureCard
                            icon="☁️"
                            title="Cloud Native"
                            description="Built on Google Drive. Your references are safe, backed up, and accessible from any device."
                        />
                    </div>
                </div>
            </section>

            {/* Content for AdSense (SEO Text) */}
            <section className="py-20 px-6 border-t border-white/5 bg-gray-900/50">
                <div className="max-w-4xl mx-auto prose prose-invert">
                    <h3 className="text-2xl font-bold mb-6">About RefBoard</h3>
                    <p className="text-gray-400 mb-4">
                        RefBoard is a cutting-edge productivity tool designed to help visual thinkers organize their workflow.
                        Whether you are a concept artist collecting mood boards, a UI/UX designer mapping out user flows,
                        or a developer planning architecture, RefBoard provides the flexible environment you need.
                    </p>
                    <p className="text-gray-400 mb-4">
                        Our mission is to replace scattered folders and browser tabs with a single, unified visual workspace.
                        RefBoard supports a wide range of media types, including images, GIFs, videos, and rich text notes.
                    </p>

                    <h3 className="text-2xl font-bold mt-12 mb-6">Key Capabilities</h3>
                    <ul className="list-disc pl-6 text-gray-400 space-y-2">
                        <li><strong>High Performance:</strong> Optimized for handling thousands of images without lag.</li>
                        <li><strong>Cross-Platform:</strong> Available on Windows, macOS, and Web.</li>
                        <li><strong>Google Drive Integration:</strong> Seamlessly sync your boards with your personal cloud storage.</li>
                        <li><strong>Export Options:</strong> Export your boards to PNG, PDF, or shareable links.</li>
                    </ul>

                    <h3 className="text-2xl font-bold mt-12 mb-6">Getting Started</h3>
                    <p className="text-gray-400">
                        To start using RefBoard, simply click the "Open Web App" button above.
                        You can sign in with your Google account to instantly access your Drive-stored boards.
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/10 text-center text-gray-500 text-sm">
                <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        &copy; 2024 RefBoard. All rights reserved.
                    </div>
                    <div className="flex gap-6">
                        <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                        <a href="#" className="hover:text-white transition-colors">Contact</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, description }: { icon: string, title: string, description: string }) => {
    return (
        <div className="bg-white/5 border border-white/5 p-6 rounded-2xl hover:bg-white/10 transition-colors">
            <div className="text-4xl mb-4">{icon}</div>
            <h3 className="text-xl font-bold mb-2">{title}</h3>
            <p className="text-gray-400 leading-relaxed">
                {description}
            </p>
        </div>
    );
};
