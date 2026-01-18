import React, { useMemo, useState } from 'react';
import { text } from 'stream/consumers';

import { useTranslation } from '../hooks/useTranslation.ts';
import { PracticeAnalyticsSummary } from '../services/practiceAnalyticsService';
import { Category, PhraseCategory, PracticeChatSessionRecord } from '../types.ts';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import ArrowRightIcon from './icons/ArrowRightIcon';
import CloseIcon from './icons/CloseIcon';

const AnalyticsCard: React.FC<{
  label: string;
  primary: string;
  secondary?: string;
}> = ({ label, primary, secondary }) => (
  <div className="bg-slate-700/60 rounded-xl p-4 border border-slate-600/60 shadow-inner">
    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    <p className="text-2xl font-semibold text-slate-100 mt-2">{primary}</p>
    {secondary && <p className="text-xs text-slate-400 mt-2 leading-snug">{secondary}</p>}
  </div>
);

interface Settings {
  autoSpeak: boolean;
  soundEffects: boolean;
  automation: {
    autoCheckShortPhrases: boolean;
    learnNextPhraseHabit: boolean;
  };
  enabledCategories: Record<PhraseCategory, boolean>;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSettingsChange: (newSettings: Partial<Settings>) => void;
  onOpenCategoryManager: () => void;
  categories: Category[];
  practiceChatSessions: PracticeChatSessionRecord[]; // DEPRECATED: no longer used for analytics
  practiceAnalyticsSummary: PracticeAnalyticsSummary;
}

type SettingsView = 'main' | 'general' | 'automation' | 'categories' | 'analytics';

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  onOpenCategoryManager,
  categories,
  practiceChatSessions,
  practiceAnalyticsSummary,
}) => {
  const { t } = useTranslation();
  const [view, setView] = useState<SettingsView>('main');

  const titles: Record<SettingsView, string> = {
    main: t('settings.views.main'),
    general: t('settings.views.general'),
    automation: t('settings.views.automation'),
    categories: t('settings.views.categories'),
    analytics: t('settings.views.analytics'),
  };

  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);
  const percentFormatter = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }), []);
  const decimalFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    []
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    []
  );

  const formatDuration = (ms: number) => {
    if (!ms || ms <= 0) return '0m';
    const totalSeconds = Math.round(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (!hours && !minutes) parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  const formatDurationDetailed = (ms: number) => {
    if (!ms || ms <= 0) return '0s';
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  };

  const formatPercentValue = (value: number | null) =>
    value !== null ? `${percentFormatter.format(value)}%` : t('settings.analytics.noData');

  const srsLevelsMaxCount = useMemo(() => {
    const counts = practiceAnalyticsSummary.levels.map((level) => level.count);
    return counts.length ? Math.max(...counts) : 1;
  }, [practiceAnalyticsSummary.levels]);

  const recentReviews = useMemo(
    () => practiceAnalyticsSummary.recentActivity.slice(-14),
    [practiceAnalyticsSummary.recentActivity]
  );

  const recentNewCards = useMemo(
    () => practiceAnalyticsSummary.newCardsByDay.slice(-14),
    [practiceAnalyticsSummary.newCardsByDay]
  );

  if (!isOpen) return null;

  const handleSettingChange = (setting: keyof Omit<Settings, 'automation' | 'enabledCategories'>, value: boolean) => {
    onSettingsChange({ [setting]: value });
  };

  const handleAutomationChange = (setting: keyof Settings['automation'], value: boolean) => {
    onSettingsChange({
      automation: {
        ...settings.automation,
        [setting]: value,
      },
    });
  };

  const handleCategoryChange = (category: PhraseCategory, value: boolean) => {
    onSettingsChange({
      enabledCategories: {
        ...settings.enabledCategories,
        [category]: value,
      },
    });
  };

  const handleClose = () => {
    setView('main'); // Reset view on close
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center backdrop-blur-sm p-0 animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-md m-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700 relative">
          {view !== 'main' && (
            <button onClick={() => setView('main')} className="absolute left-4 p-2 rounded-full hover:bg-slate-700">
              <ArrowLeftIcon className="w-6 h-6 text-slate-600" />
            </button>
          )}
          <h2 className="text-sm font-bold text-slate-400 w-full text-center">{titles[view]}</h2>
          <button onClick={handleClose} className="p-2 rounded-full hover:bg-slate-700 absolute right-4">
            <CloseIcon className="w-6 h-6 text-slate-600" />
          </button>
        </header>
        <div className="relative h-[480px] overflow-hidden">
          {/* Main Settings View */}
          <div
            className={`absolute inset-0 p-2 space-y-2 transition-transform duration-300 ease-in-out ${view === 'main' ? 'translate-x-0' : '-translate-x-full'
              }`}
          >
            <button
              onClick={() => setView('analytics')}
              className="w-full flex items-center justify-between p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <span className="text-left text-slate-200">{t('settings.views.analytics')}</span>
              <ArrowRightIcon className="w-5 h-5 text-slate-400" />
            </button>
            <button
              onClick={() => setView('general')}
              className="w-full flex items-center justify-between p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <span className="text-left text-slate-200">{t('settings.views.general')}</span>
              <ArrowRightIcon className="w-5 h-5 text-slate-400" />
            </button>
            <button
              onClick={() => setView('automation')}
              className="w-full flex items-center justify-between p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <span className="text-left text-slate-200">{t('settings.views.automation')}</span>
              <ArrowRightIcon className="w-5 h-5 text-slate-400" />
            </button>
            <button
              onClick={() => setView('categories')}
              className="w-full flex items-center justify-between p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <span className="text-left text-slate-200">{t('settings.views.categories')}</span>
              <ArrowRightIcon className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* General View */}
          <div
            className={`absolute inset-0 p-3 space-y-6 transition-transform duration-300 ease-in-out ${view === 'general' ? 'translate-x-0' : 'translate-x-full'
              }`}
          >
            <fieldset className="space-y-4">
              <legend className="sr-only">{t('settings.general.legend')}</legend>
              <div className="flex items-center justify-between">
                <label htmlFor="autoSpeak" className="text-slate-200">
                  {t('settings.general.autoSpeak.label')}
                </label>
                <div>
                  <button
                    id="autoSpeak"
                    role="switch"
                    aria-checked={settings.autoSpeak}
                    onClick={() => handleSettingChange('autoSpeak', !settings.autoSpeak)}
                    className={`${settings.autoSpeak ? 'bg-purple-600' : 'bg-slate-600'
                      } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                  >
                    <span
                      className={`${settings.autoSpeak ? 'translate-x-6' : 'translate-x-1'
                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label htmlFor="soundEffects" className="text-slate-200">
                  {t('settings.general.soundEffects.label')}
                </label>
                <button
                  id="soundEffects"
                  role="switch"
                  aria-checked={settings.soundEffects}
                  onClick={() => handleSettingChange('soundEffects', !settings.soundEffects)}
                  className={`${settings.soundEffects ? 'bg-purple-600' : 'bg-slate-600'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                >
                  <span
                    className={`${settings.soundEffects ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                  />
                </button>
              </div>
            </fieldset>
          </div>

          {/* Automation View */}
          <div
            className={`absolute inset-0 p-3 space-y-6 transition-transform duration-300 ease-in-out ${view === 'automation' ? 'translate-x-0' : 'translate-x-full'
              }`}
          >
            <fieldset className="space-y-4">
              <legend className="sr-only">{t('settings.automation.legend')}</legend>
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="autoCheckShortPhrases" className="text-sm text-slate-200">
                    {t('settings.automation.autoCheckShortPhrases.label')}
                  </label>
                  <p className="text-xs text-slate-400">{t('settings.automation.autoCheckShortPhrases.description')}</p>
                </div>
                <div>
                  <button
                    id="autoCheckShortPhrases"
                    role="switch"
                    aria-checked={settings.automation.autoCheckShortPhrases}
                    onClick={() =>
                      handleAutomationChange('autoCheckShortPhrases', !settings.automation.autoCheckShortPhrases)
                    }
                    className={`${settings.automation.autoCheckShortPhrases ? 'bg-purple-600' : 'bg-slate-600'
                      } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                  >
                    <span
                      className={`${settings.automation.autoCheckShortPhrases ? 'translate-x-6' : 'translate-x-1'
                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="learnNextPhraseHabit" className="text-sm text-slate-200">
                    {t('settings.automation.learnNextPhraseHabit.label')}
                  </label>
                  <p className="text-xs text-slate-400">{t('settings.automation.learnNextPhraseHabit.description')}</p>
                </div>
                <div>
                  <button
                    id="learnNextPhraseHabit"
                    role="switch"
                    aria-checked={settings.automation.learnNextPhraseHabit}
                    onClick={() =>
                      handleAutomationChange('learnNextPhraseHabit', !settings.automation.learnNextPhraseHabit)
                    }
                    className={`${settings.automation.learnNextPhraseHabit ? 'bg-purple-600' : 'bg-slate-600'
                      } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                  >
                    <span
                      className={`${settings.automation.learnNextPhraseHabit ? 'translate-x-6' : 'translate-x-1'
                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </button>
                </div>
              </div>
            </fieldset>
          </div>

          {/* Categories View */}
          <div
            className={`absolute inset-0 p-2 space-y-4 transition-transform duration-300 ease-in-out hide-scrollbar overflow-y-auto ${view === 'categories' ? 'translate-x-0' : 'translate-x-full'
              }`}
          >
            <div className="bg-slate-900/50 p-4 rounded-lg space-y-4 h-[85%] flex flex-col justify-between overflow-y-auto">
              {categories.map((category) => (
                <div className="flex items-center justify-between" key={category.id}>
                  <label htmlFor={category.id} className="text-sm text-slate-300 flex items-center font-light">
                    <span className={`min-w-3 min-h-3 rounded-full mr-2 ${category.color}`}></span>
                    {category.name}
                  </label>
                  <div>
                    <button
                      id={category.id}
                      role="switch"
                      aria-checked={settings.enabledCategories[category.id] ?? true}
                      onClick={() =>
                        handleCategoryChange(category.id, !(settings.enabledCategories[category.id] ?? true))
                      }
                      className={`${(settings.enabledCategories[category.id] ?? true) ? 'bg-purple-600' : 'bg-slate-600'
                        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                    >
                      <span
                        className={`${(settings.enabledCategories[category.id] ?? true) ? 'translate-x-6' : 'translate-x-1'
                          } inline-block h-4 min-w-4 transform rounded-full bg-white transition-transform`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={onOpenCategoryManager}
              className="w-full text-center px-4 py-3 rounded-lg bg-slate-600 hover:bg-slate-700 transition-colors font-semibold text-white shadow-md mt-2"
            >
              {t('settings.categories.manageButton')}
            </button>
          </div>

          {/* Analytics View - SRS Practice Analytics */}
          <div
            className={`absolute inset-0 p-3 space-y-6 transition-transform duration-300 ease-in-out hide-scrollbar overflow-y-auto ${view === 'analytics' ? 'translate-x-0' : 'translate-x-full'
              }`}
          >
            {practiceAnalyticsSummary.totals.totalCards > 0 ? (
              <>
                {/* KPI Cards */}
                <div className="grid gap-3 grid-cols-2">
                  <AnalyticsCard
                    label={t('settings.analytics.srs.totalCards')}
                    primary={numberFormatter.format(practiceAnalyticsSummary.totals.totalCards)}
                    secondary={t('settings.analytics.srs.masteryProgress', {
                      percent: practiceAnalyticsSummary.totals.masteryProgressPercent,
                    })}
                  />
                  <AnalyticsCard
                    label={t('settings.analytics.srs.mastered')}
                    primary={numberFormatter.format(practiceAnalyticsSummary.totals.mastered)}
                    secondary={t('settings.analytics.srs.learning', {
                      value: numberFormatter.format(practiceAnalyticsSummary.totals.learning),
                    })}
                  />
                  <AnalyticsCard
                    label={t('settings.analytics.srs.dueToday')}
                    primary={numberFormatter.format(practiceAnalyticsSummary.totals.dueToday)}
                    secondary={t('settings.analytics.srs.overdue', {
                      value: numberFormatter.format(practiceAnalyticsSummary.totals.overdue),
                    })}
                  />
                  <AnalyticsCard
                    label={t('settings.analytics.srs.accuracy')}
                    primary={formatPercentValue(practiceAnalyticsSummary.accuracy.overall)}
                    secondary={t('settings.analytics.srs.reviews', {
                      value: numberFormatter.format(practiceAnalyticsSummary.accuracy.totalReviews),
                    })}
                  />
                </div>

                {/* Streak */}
                {practiceAnalyticsSummary.accuracy.streakDays > 0 && (
                  <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl p-4">
                    <p className="text-sm text-purple-200">
                      {t('settings.analytics.srs.streak', {
                        days: numberFormatter.format(practiceAnalyticsSummary.accuracy.streakDays),
                      })}
                    </p>
                  </div>
                )}

                {/* Accuracy Breakdown */}
                <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-4 shadow-inner">
                  <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-3">
                    {t('settings.analytics.srs.accuracyBreakdown')}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-300">{t('settings.analytics.srs.overall')}</span>
                      <span className="text-slate-100 font-semibold">
                        {formatPercentValue(practiceAnalyticsSummary.accuracy.overall)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">{t('settings.analytics.srs.last7Days')}</span>
                      <span className="text-slate-100 font-semibold">
                        {formatPercentValue(practiceAnalyticsSummary.accuracy.last7Days)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">{t('settings.analytics.srs.last30Days')}</span>
                      <span className="text-slate-100 font-semibold">
                        {formatPercentValue(practiceAnalyticsSummary.accuracy.last30Days)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SRS Levels Distribution */}
                <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-4 shadow-inner">
                  <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-3">
                    {t('settings.analytics.srs.levelsDistribution')}
                  </h3>
                  <div className="space-y-2">
                    {practiceAnalyticsSummary.levels.map((level) => {
                      const percent = srsLevelsMaxCount > 0 ? (level.count / srsLevelsMaxCount) * 100 : 0;
                      return (
                        <div key={level.level} className="flex items-center gap-3">
                          <span className="text-xs text-slate-400 w-12">
                            {t('settings.analytics.srs.level', {
                              level: level.level,
                            })}
                          </span>
                          <div className="flex-1 h-6 bg-slate-700/60 rounded-lg overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-end px-2"
                              style={{ width: `${Math.max(percent, 3)}%` }}
                            >
                              <span className="text-xs font-semibold text-white">{level.count}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Categories Stats */}
                {practiceAnalyticsSummary.categories.length > 0 && (
                  <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-4 shadow-inner">
                    <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-3">
                      {t('settings.analytics.srs.categories')}
                    </h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {practiceAnalyticsSummary.categories.map((cat) => (
                        <div key={cat.id} className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-slate-100">{cat.name}</span>
                            <span className="text-xs text-slate-400">
                              {numberFormatter.format(cat.total)} {t('settings.analytics.srs.cards')}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-slate-400">{t('settings.analytics.srs.mastered')}</p>
                              <p className="text-slate-100 font-semibold">{numberFormatter.format(cat.mastered)}</p>
                            </div>
                            <div>
                              <p className="text-slate-400">{t('settings.analytics.srs.avgLevel')}</p>
                              <p className="text-slate-100 font-semibold">
                                {decimalFormatter.format(cat.avgMasteryLevel)}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400">{t('settings.analytics.srs.accuracy')}</p>
                              <p className="text-slate-100 font-semibold">{formatPercentValue(cat.accuracy)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Activity - Always show */}
                <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-4 shadow-inner">
                  <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-3">
                    {t('settings.analytics.srs.recentActivity')}
                  </h3>
                  {recentReviews.length > 0 ? (
                    <div className="flex gap-1 items-end h-24">
                      {recentReviews.map((day) => {
                        const maxHeight = Math.max(...recentReviews.map((d) => d.total), 1);
                        const heightPercent = (day.total / maxHeight) * 100;
                        const correctPercent = day.total > 0 ? (day.correct / day.total) * 100 : 0;
                        return (
                          <div key={day.date} className="flex-1 flex flex-col items-center">
                            <div
                              className="w-full bg-slate-700/60 rounded-t relative"
                              style={{
                                height: `${Math.max(heightPercent, 5)}%`,
                              }}
                            >
                              <div
                                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 to-green-400 rounded-t"
                                style={{ height: `${correctPercent}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 mt-1">{new Date(day.date).getDate()}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-24 text-sm text-slate-500">
                      {t('settings.analytics.srs.noActivityYet')}
                    </div>
                  )}
                </div>

                {/* Leeches - Always show */}
                <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-4 shadow-inner">
                  <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-3">
                    {t('settings.analytics.srs.difficultCards')}
                  </h3>
                  {practiceAnalyticsSummary.leeches.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {practiceAnalyticsSummary.leeches.slice(0, 10).map((leech) => (
                        <div
                          key={leech.phraseId}
                          className="bg-slate-800/60 border border-red-900/40 rounded-lg p-2 flex justify-between items-center"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-100 truncate">{leech.learning}</p>
                            <p className="text-xs text-slate-400 truncate">{leech.native}</p>
                          </div>
                          <span className="ml-2 px-2 py-1 bg-red-900/40 text-red-300 text-xs font-semibold rounded">
                            {leech.lapses} {t('settings.analytics.srs.lapses')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-20 text-sm text-slate-500">
                      {t('settings.analytics.srs.noDifficultCards')}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col justify-center items-center text-center space-y-3 text-slate-400">
                <p className="text-base font-semibold">{t('settings.analytics.srs.emptyState')}</p>
                <p className="text-sm text-slate-500 max-w-xs">{t('settings.analytics.srs.emptyStateHint')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
