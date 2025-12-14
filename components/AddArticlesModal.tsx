
import React from 'react';
import { IoCheckmarkCircleOutline, IoCloseCircleOutline, IoRefreshOutline, IoSearchOutline } from 'react-icons/io5';
import Spinner from './Spinner';
import type { AddArticlesState } from '../hooks/useAddArticles';

interface AddArticlesModalProps {
    state: AddArticlesState;
    onDismiss: () => void;
    onStartFix: () => void;
}

const AddArticlesModal: React.FC<AddArticlesModalProps> = ({ state, onDismiss, onStartFix }) => {
    const { status, foundPhrases, progress, error, result } = state;

    if (status === 'idle') return null;

    const getStatusInfo = () => {
        switch (status) {
            case 'analyzing':
                return {
                    icon: <IoSearchOutline className="w-12 h-12 text-blue-500 animate-pulse" />,
                    title: 'Поиск существительных',
                    description: 'Ищем слова без артиклей...',
                };
            case 'confirm':
                return {
                    icon: <IoCheckmarkCircleOutline className="w-12 h-12 text-blue-500" />,
                    title: 'Найдено кандидатов',
                    description: `Мы нашли ${foundPhrases.length} слов, которым, вероятно, нужен артикль (Der/Die/Das).`,
                };
            case 'fixing':
                return {
                    icon: <IoRefreshOutline className="w-12 h-12 text-purple-500 animate-spin" />,
                    title: 'Добавляем артикли',
                    description: 'AI подбирает правильные артикли...',
                };
            case 'completed':
                return {
                    icon: <IoCheckmarkCircleOutline className="w-12 h-12 text-green-500" />,
                    title: 'Готово!',
                    description: 'Процесс завершен.',
                };
            case 'error':
                return {
                    icon: <IoCloseCircleOutline className="w-12 h-12 text-red-500" />,
                    title: 'Ошибка',
                    description: 'Что-то пошло не так.',
                };
            default:
                return { icon: null, title: '', description: '' };
        }
    };

    const statusInfo = getStatusInfo();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={status !== 'fixing' ? onDismiss : undefined} />

            <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 max-w-lg w-full relative z-10 overflow-hidden">
                <div className="p-8 text-center border-b border-slate-700">
                    <div className="flex justify-center mb-4">{statusInfo.icon}</div>
                    <h2 className="text-2xl font-bold text-white mb-2">{statusInfo.title}</h2>
                    <p className="text-slate-300 text-sm">{statusInfo.description}</p>
                </div>

                <div className="p-6">
                    {/* Confirm Step */}
                    {status === 'confirm' && (
                        <div className="space-y-4">
                            <div className="bg-slate-700/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                                <p className="text-xs text-slate-400 mb-2">Примеры найденных слов:</p>
                                <div className="flex flex-wrap gap-2">
                                    {foundPhrases.slice(0, 20).map(p => (
                                        <span key={p.id} className="text-xs bg-slate-600 px-2 py-1 rounded text-slate-200">
                                            {p.text.learning}
                                        </span>
                                    ))}
                                    {foundPhrases.length > 20 && <span className="text-xs text-slate-500 self-center">...</span>}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={onDismiss} className="flex-1 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg">
                                    Отмена
                                </button>
                                <button onClick={onStartFix} className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg">
                                    Запустить AI
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Progress Step */}
                    {status === 'fixing' && progress && (
                        <div className="space-y-4">
                            <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                                <div className="bg-purple-500 h-full transition-all duration-300" style={{ width: `${(progress.processed / progress.total) * 100}%` }} />
                            </div>
                            <div className="flex justify-between text-sm text-slate-400">
                                <span>{progress.processed} / {progress.total}</span>
                                <span>Успешно: {progress.successful}</span>
                            </div>
                        </div>
                    )}

                    {/* Completed Step */}
                    {status === 'completed' && result && (
                        <div className="space-y-4">
                            <div className="bg-green-500/10 rounded-lg p-4 text-center">
                                <p className="text-green-400 font-bold text-xl mb-1">{result.totalUpdated}</p>
                                <p className="text-green-200 text-sm">слов обновлено</p>
                            </div>

                            {result.examples.length > 0 && (
                                <div className="bg-slate-700/50 rounded-lg p-3">
                                    <p className="text-xs text-slate-400 mb-2">Примеры изменений:</p>
                                    <ul className="space-y-1 text-sm">
                                        {result.examples.map((ex, i) => (
                                            <li key={i} className="flex justify-between">
                                                <span className="text-red-300">{ex.before}</span>
                                                <span className="text-slate-500">→</span>
                                                <span className="text-green-300">{ex.after}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <button onClick={onDismiss} className="w-full py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg">
                                Закрыть
                            </button>
                        </div>
                    )}

                    {/* Error Step */}
                    {status === 'error' && (
                        <div className="space-y-4">
                            <p className="text-red-300 bg-red-900/20 p-3 rounded">{error}</p>
                            <button onClick={onDismiss} className="w-full py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg">
                                Закрыть
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddArticlesModal;
