import React, { useState, useEffect } from 'react';
import { getCurrentUser, onAuthChange } from '../services/firebaseAuth';
import { listBoards as listDriveBoards, deleteBoard, listSharedBoards } from '../services/googleDrive';

interface Board {
    id: string;
    name: string;
    modifiedTime: string;
    thumbnail?: string;
    owners?: {
        displayName: string;
        emailAddress: string;
    }[];
}

interface BoardListScreenProps {
    onBoardSelect: (boardId: string | null, boardName?: string, initialLocation?: { x: number; y: number; scale?: number }) => void;
}


const ThumbnailImage: React.FC<{ thumbnail: string; boardName: string; index: number }> = ({ thumbnail, boardName, index }) => {
    const [imageError, setImageError] = React.useState(false);
    const [imageLoaded, setImageLoaded] = React.useState(false);

    return (
        <>
            {!imageError ? (
                <img
                    src={thumbnail}
                    alt={boardName}
                    className={`w-full h-full object-cover rounded transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => {
                        console.warn('Failed to load thumbnail for board:', boardName);
                        setImageError(true);
                        setImageLoaded(false);
                    }}
                    loading="lazy"
                    style={{
                        animationDelay: `${index * 50}ms`
                    }}
                />
            ) : (
                <span className="text-4xl">📋</span>
            )}
            {!imageLoaded && !imageError && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
        </>
    );
};

export const BoardListScreen: React.FC<BoardListScreenProps> = ({ onBoardSelect }) => {
    const [boards, setBoards] = useState<Board[]>([]);
    const [sharedBoards, setSharedBoards] = useState<Board[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showNewBoardDialog, setShowNewBoardDialog] = useState(false);
    const [newBoardName, setNewBoardName] = useState('');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [boardToDelete, setBoardToDelete] = useState<{ id: string; name: string } | null>(null);
    const [deleteConfirmName, setDeleteConfirmName] = useState('');
    const user = getCurrentUser();

    useEffect(() => {
        // Auto-detect link from clipboard on focus (optional enhancement)
        const handleFocus = async () => {
            // Disabled auto-paste to avoid annoyance, user manually triggers it via UI
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);




    // Load boards when auth state changes (login/logout)
    useEffect(() => {
        const unsubscribe = onAuthChange((authUser) => {
            if (authUser) {
                // User is logged in, load boards
                loadBoards();
            } else {
                // User logged out, clear boards
                setBoards([]);
                setSharedBoards([]);
            }
        });

        return () => unsubscribe();
    }, []);

    async function loadBoards() {
        try {
            setIsLoading(true);
            const [myBoards, shared] = await Promise.all([
                listDriveBoards(),
                listSharedBoards()
            ]);
            setBoards(myBoards);
            setSharedBoards(shared);
        } catch (error) {
            console.error('Failed to load boards:', error);
        } finally {
            setIsLoading(false);
        }
    }

    const handleNewBoardClick = () => {
        setNewBoardName('새 보드');
        setShowNewBoardDialog(true);
    };

    const handleCreateBoard = () => {
        if (newBoardName.trim()) {
            onBoardSelect('new', newBoardName.trim());
            setShowNewBoardDialog(false);
        }
    };

    const handleDeleteBoard = (e: React.MouseEvent, boardId: string, boardName: string) => {
        e.stopPropagation();
        setBoardToDelete({ id: boardId, name: boardName });
        setDeleteConfirmName('');
        setShowDeleteDialog(true);
    };

    const confirmDeleteBoard = async () => {
        if (!boardToDelete) return;

        try {
            await deleteBoard(boardToDelete.id);
            setShowDeleteDialog(false);
            setBoardToDelete(null);
            setDeleteConfirmName('');
            await loadBoards(); // Reload list
        } catch (error) {
            console.error('Failed to delete board:', error);
            alert('보드 삭제에 실패했습니다.');
        }
    };

    const handleBoardClick = (boardId: string, boardName?: string) => {
        onBoardSelect(boardId, boardName);
    };

    const renderBoardCard = (board: Board, index: number) => (
        <div
            key={board.id}
            onClick={() => handleBoardClick(board.id, board.name)}
            className="group bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-700 transition-colors border border-gray-700 hover:border-blue-500 relative"
        >
            <div className="aspect-video bg-gray-700 rounded mb-3 flex items-center justify-center relative overflow-hidden">
                {board.thumbnail ? (
                    <ThumbnailImage thumbnail={board.thumbnail} boardName={board.name} index={index} />
                ) : (
                    <span className="text-4xl">📋</span>
                )}

                {/* Owner Badge */}
                {board.owners && board.owners.length > 0 && (
                    <div className="absolute top-2 left-2 bg-blue-600/90 text-white text-xs px-2 py-1 rounded-full shadow-sm backdrop-blur-sm z-10 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>{board.owners[0].displayName}</span>
                    </div>
                )}

                {/* Delete Button (Visible on Hover) */}
                <button
                    onClick={(e) => handleDeleteBoard(e, board.id, board.name)}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    title="보드 삭제"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
            <h3 className="font-semibold truncate">{board.name}</h3>
            <p className="text-sm text-gray-400">
                {new Date(board.modifiedTime).toLocaleDateString('ko-KR')}
            </p>
        </div>
    );



    return (
        <div className="w-screen h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex flex-col relative">
            {/* Header */}
            <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">RefBoard</h1>
                        <p className="text-sm text-gray-400">
                            {user?.displayName || user?.email}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={async () => {
                                const { signOut } = await import('../services/firebaseAuth');
                                await signOut();
                                window.location.reload();
                            }}
                            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition-colors"
                        >
                            로그아웃
                        </button>

                        <button
                            onClick={handleNewBoardClick}
                            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold transition-colors"
                        >
                            + 새 보드
                        </button>
                    </div>
                </div>
            </div>

            {/* Board Grid */}
            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-6xl mx-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : boards.length === 0 && sharedBoards.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="text-6xl mb-4">📋</div>
                            <h2 className="text-2xl font-semibold mb-2">보드가 없습니다</h2>
                            <p className="text-gray-400 mb-6">
                                새 보드를 만들어 시작하세요!
                            </p>
                            <button
                                onClick={handleNewBoardClick}
                                className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-semibold transition-colors inline-block"
                            >
                                첫 보드 만들기
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* My Boards */}
                            {boards.length > 0 && (
                                <div>
                                    <h2 className="text-lg font-semibold mb-4 text-gray-300">내 보드 ({boards.length}개)</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {boards.map((board, index) => renderBoardCard(board, index))}
                                    </div>
                                </div>
                            )}

                            {/* Shared Boards */}
                            {sharedBoards.length > 0 && (
                                <div>
                                    <h2 className="text-lg font-semibold mb-4 text-gray-300 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        공유된 보드 ({sharedBoards.length}개)
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {sharedBoards.map((board, index) => renderBoardCard(board, boards.length + index))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>



            {/* Refresh Button */}
            <button
                onClick={() => loadBoards()}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all z-40 group"
                title="보드 목록 새로고침"
            >
                <svg
                    className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            </button>



            {/* New Board Dialog */}
            {showNewBoardDialog && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
                        <h3 className="text-xl font-bold mb-4">새 보드 만들기</h3>
                        <input
                            type="text"
                            value={newBoardName}
                            onChange={(e) => setNewBoardName(e.target.value)}
                            placeholder="보드 이름 입력"
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 mb-6 focus:outline-none focus:border-blue-500"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowNewBoardDialog(false)}
                                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleCreateBoard}
                                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold transition-colors"
                            >
                                만들기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            {showDeleteDialog && boardToDelete && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md border border-red-700">
                        <h3 className="text-xl font-bold mb-2 text-red-500">⚠️ 보드 삭제</h3>
                        <p className="text-sm text-gray-300 mb-4">
                            이 작업은 되돌릴 수 없습니다. 보드와 모든 이미지가 영구적으로 삭제됩니다.
                        </p>
                        <div className="bg-gray-900 p-3 rounded-lg mb-4">
                            <p className="text-sm text-gray-400 mb-2">
                                삭제하려면 보드 이름을 입력하세요:
                            </p>
                            <p className="font-bold text-white">{boardToDelete.name}</p>
                        </div>
                        <input
                            type="text"
                            value={deleteConfirmName}
                            onChange={(e) => setDeleteConfirmName(e.target.value)}
                            placeholder="보드 이름 입력"
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 mb-6 focus:outline-none focus:border-red-500"
                            autoFocus
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteDialog(false);
                                    setBoardToDelete(null);
                                    setDeleteConfirmName('');
                                }}
                                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={confirmDeleteBoard}
                                disabled={deleteConfirmName !== boardToDelete.name}
                                className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                삭제하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
