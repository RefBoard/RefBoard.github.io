import React, { useState } from 'react';

interface LoginScreenProps {
    onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDrivePermissionButton, setShowDrivePermissionButton] = useState(false);

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { signInWithGoogle } = await import('../services/firebaseAuth');
            const result = await signInWithGoogle();

            if (result.success && result.user) {
                console.log('Logged in as:', result.user.displayName, result.user.email);

                // Request Drive API access using Google Identity Services
                try {
                    const { initGoogleIdentityServices, requestDriveAccess } = await import('../services/googleIdentity');
                    initGoogleIdentityServices();

                    // Hardcode client ID (from .env file)
                    const clientId = '145147670860-l0bu8h9lvmf1gjqd09q66g4jbb4i69q2.apps.googleusercontent.com';

                    console.log('Requesting Drive access...');
                    await requestDriveAccess(clientId);
                    console.log('✅ Drive access granted!');
                    onLogin();
                } catch (driveError) {
                    console.error('Drive access error:', driveError);
                    // If popup blocked or failed, show manual button
                    setShowDrivePermissionButton(true);
                    setError('Google Drive 접근 권한이 필요합니다. 아래 버튼을 눌러 권한을 허용해주세요.');
                }
            } else {
                setError(result.error || 'Login failed');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGrantDriveAccess = async () => {
        try {
            const { requestDriveAccess } = await import('../services/googleIdentity');
            const clientId = '145147670860-l0bu8h9lvmf1gjqd09q66g4jbb4i69q2.apps.googleusercontent.com';
            await requestDriveAccess(clientId);
            onLogin();
        } catch (err) {
            setError('권한 허용에 실패했습니다. 다시 시도해주세요.');
        }
    };

    return (
        <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">RefBoard</h1>
                    <p className="text-gray-600">협업 레퍼런스 보드</p>
                </div>

                <div className="mb-8">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h3 className="font-semibold text-blue-900 mb-2">RefBoard를 사용하면:</h3>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>✓ Google Drive에 자동 저장</li>
                            <li>✓ 팀원들과 실시간 협업</li>
                            <li>✓ 어디서나 작업 이어하기</li>
                        </ul>
                    </div>
                </div>

                {!showDrivePermissionButton ? (
                    <button
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                        className="w-full bg-white border-2 border-gray-300 hover:border-blue-500 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                로그인 중...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Google로 로그인
                            </>
                        )}
                    </button>
                ) : (
                    <button
                        onClick={handleGrantDriveAccess}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-3"
                    >
                        Google Drive 권한 허용하기
                    </button>
                )}

                {error && (
                    <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <div className="mt-6 text-center text-xs text-gray-500">
                    로그인하면{' '}
                    <a href="https://refboard.github.io/terms.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        이용약관
                    </a>
                    {' '}및{' '}
                    <a href="https://refboard.github.io/privacy.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        개인정보처리방침
                    </a>
                    에 동의하게 됩니다.
                </div>
            </div>
        </div>
    );
};
