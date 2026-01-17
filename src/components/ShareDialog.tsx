import React, { useState, useEffect } from 'react';
import { shareBoard, getBoardPermissions, removeBoardPermission, Permission, shareImages, fixMediaPermissions } from '../services/googleDrive';


interface ShareDialogProps {
    boardId: string;
    boardName: string;
    items?: Array<{ type: string; driveFileId?: string }>;
    onClose: () => void;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({ boardId, boardName, items = [], onClose }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'reader' | 'writer'>('reader');
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);


    useEffect(() => {
        loadPermissions();
    }, [boardId]);

    async function loadPermissions() {
        try {
            setIsLoading(true);
            const perms = await getBoardPermissions(boardId);
            // Filter out the owner (current user)
            setPermissions(perms.filter(p => p.role !== 'owner'));
        } catch (err) {
            console.error('Failed to load permissions:', err);
        } finally {
            setIsLoading(false);
        }
    }

    const handleFixPermissions = async () => {
        try {
            if (!confirm('보드의 모든 이미지와 비디오를 "링크가 있는 모든 사용자"가 볼 수 있도록 설정하시겠습니까? (이 작업은 시간이 걸릴 수 있습니다)')) {
                return;
            }

            setIsLoading(true);
            setError(null);
            setSuccess(null);

            const mediaFileIds = items
                .filter((item: { type: string; driveFileId?: string }) =>
                    (item.type === 'image' || item.type === 'video') && item.driveFileId
                )
                .map((item: { type: string; driveFileId?: string }) => item.driveFileId!);

            if (mediaFileIds.length === 0) {
                setSuccess('복구할 미디어 파일이 없습니다.');
                setIsLoading(false);
                return;
            }

            const result = await fixMediaPermissions(mediaFileIds);
            setSuccess(`미디어 권한 복구 완료: ${result.success}개 성공, ${result.failed}개 실패.`);
        } catch (err) {
            console.error('Failed to fix permissions:', err);
            setError('미디어 권한 복구에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleShare = async () => {
        if (!email.trim()) {
            setError('이메일을 입력해주세요.');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('올바른 이메일 형식이 아닙니다.');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            setSuccess(null);

            // Share board
            await shareBoard(boardId, email.trim(), role);

            // Also share all images and videos in the board
            const mediaFileIds = items
                .filter((item: { type: string; driveFileId?: string }) =>
                    (item.type === 'image' || item.type === 'video') && item.driveFileId
                )
                .map((item: { type: string; driveFileId?: string }) => item.driveFileId!);

            if (mediaFileIds.length > 0) {
                try {
                    // Share each media file individually to get better error reporting
                    const shareResults = await Promise.allSettled(
                        mediaFileIds.map(fileId => shareImages([fileId], email.trim(), role))
                    );

                    const successful = shareResults.filter(r => r.status === 'fulfilled').length;
                    const failed = shareResults.filter(r => r.status === 'rejected').length;

                    console.log(`Shared ${successful}/${mediaFileIds.length} media files (images/videos) with ${email}`);

                    if (failed > 0) {
                        console.warn(`Failed to share ${failed} media files. Check console for details.`);
                        shareResults.forEach((result, index) => {
                            if (result.status === 'rejected') {
                                console.error(`Failed to share media file ${mediaFileIds[index]}:`, result.reason);
                            }
                        });
                    }
                } catch (mediaErr) {
                    console.error('Failed to share media files:', mediaErr);
                    // Don't fail the whole operation if media sharing fails
                }
            }

            setSuccess(`${email}에게 공유되었습니다!`);
            setEmail('');
            await loadPermissions();
        } catch (err) {
            setError('공유에 실패했습니다. 다시 시도해주세요.');
            console.error('Share error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemove = async (permissionId: string, userEmail?: string) => {
        if (!window.confirm(`${userEmail || '이 사용자'}의 액세스를 제거하시겠습니까?`)) {
            return;
        }

        try {
            setIsLoading(true);
            await removeBoardPermission(boardId, permissionId);
            setSuccess('액세스가 제거되었습니다.');
            await loadPermissions();
        } catch (err) {
            setError('액세스 제거에 실패했습니다.');
            console.error('Remove permission error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-gray-700">
                {/* Header */}
                <div className="p-6 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold">보드 공유</h3>
                            <p className="text-sm text-gray-400 mt-1">{boardName}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                    {/* Add User Form */}
                    <div>
                        <label className="block text-sm font-medium mb-2">사용자 추가</label>
                        <div className="flex gap-3">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="이메일 입력"
                                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                                onKeyDown={(e) => e.key === 'Enter' && handleShare()}
                            />
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value as 'reader' | 'writer')}
                                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                            >
                                <option value="reader">보기 전용</option>
                                <option value="writer">편집 가능</option>
                            </select>
                            <button
                                onClick={handleShare}
                                disabled={isLoading}
                                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
                            >
                                공유
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="bg-red-900/30 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-900/30 border border-green-500/50 text-green-200 px-4 py-3 rounded-lg text-sm">
                            {success}
                        </div>
                    )}

                    {/* Current Collaborators */}
                    <div>
                        <label className="block text-sm font-medium mb-3">협업자 ({permissions.length}명)</label>
                        {isLoading && permissions.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                로딩 중...
                            </div>
                        ) : permissions.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                아직 공유된 사용자가 없습니다.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {permissions.map((perm) => (
                                    <div
                                        key={perm.id}
                                        className="flex items-center justify-between bg-gray-700/50 rounded-lg px-4 py-3 border border-gray-600"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold">
                                                {perm.displayName ? perm.displayName[0].toUpperCase() : perm.emailAddress?.[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    {perm.displayName || perm.emailAddress || '알 수 없는 사용자'}
                                                </p>
                                                {perm.emailAddress && perm.displayName && (
                                                    <p className="text-sm text-gray-400">{perm.emailAddress}</p>
                                                )}
                                                <p className="text-xs text-gray-400">
                                                    {perm.role === 'reader' ? '보기 전용' : '편집 가능'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemove(perm.id, perm.emailAddress)}
                                            className="text-red-400 hover:text-red-300 transition-colors text-sm px-3 py-1 rounded hover:bg-red-900/20"
                                        >
                                            제거
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Media Permissions Fix (Troubleshooting) */}
                    <div className="border-t border-gray-700 pt-6">
                        <h4 className="text-sm font-medium mb-3 text-gray-300">문제 해결</h4>
                        <div className="flex items-center justify-between bg-gray-700/30 rounded-lg p-4 border border-gray-600">
                            <div>
                                <p className="font-medium text-sm">미디어가 보이지 않나요?</p>
                                <p className="text-xs text-gray-400 mt-1">공유된 사용자가 미디어를 볼 수 없다면 권한을 복구해보세요.</p>
                            </div>
                            <button
                                onClick={handleFixPermissions}
                                disabled={isLoading}
                                className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded text-xs font-semibold transition-colors border border-gray-500 whitespace-nowrap ml-4"
                            >
                                미디어 권한 복구
                            </button>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-sm text-blue-200">
                        <p className="font-medium mb-1">💡 공유 방법</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>이메일을 입력하고 권한 수준을 선택하세요.</li>
                            <li><strong>보기 전용</strong>: 보드를 볼 수만 있습니다.</li>
                            <li><strong>편집 가능</strong>: 보드를 수정할 수 있습니다.</li>
                            <li>공유된 사용자는 Google Drive를 통해 이메일 알림을 받습니다.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div >
    );
};
