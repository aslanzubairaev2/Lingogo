
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../src/hooks/useTranslation';
import { useLanguage } from '../src/contexts/languageContext';
import { ProposedCard, Phrase, Category, LanguageCode } from '../types';
import CloseIcon from './icons/CloseIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import CheckIcon from './icons/CheckIcon';
import Spinner from './Spinner';
import RefreshIcon from './icons/RefreshIcon';
import ClipboardIcon from './icons/ClipboardIcon';
import SmartToyIcon from './icons/SmartToyIcon';
import SendIcon from './icons/SendIcon';
import * as fuzzyService from '../services/fuzzyService';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import PencilIcon from './icons/PencilIcon';
import ImageIcon from './icons/ImageIcon';
import FileImportView from './FileImportView';
import CardListSkeleton from './CardListSkeleton';
import { getSpeechLocale, getLanguageLabel } from '../src/i18n/languageMeta';

type View = 'assistant' | 'speech' | 'file' | 'classifying' | 'suggestion' | 'processing' | 'preview';
type SpeechStatus = 'idle' | 'recording' | 'stopped';

interface SmartImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateCards: (transcript: string, lang: LanguageCode) => Promise<ProposedCard[]>;
  onGenerateCardsFromImage: (imageData: { mimeType: string, data: string }, refinement?: string) => Promise<{ cards: ProposedCard[], categoryName: string }>;
  onGenerateTopicCards: (topic: string, refinement?: string, existingPhrases?: string[]) => Promise<ProposedCard[]>;
  onCardsCreated: (cards: ProposedCard[], options?: { categoryId?: string; createCategoryName?: string }) => Promise<void>;
  onClassifyTopic: (topic: string) => Promise<{ isCategory: boolean; categoryName: string }>;
  initialTopic?: string;
  allPhrases: Phrase[];
  categories: Category[];
}

const SmartImportModal: React.FC<SmartImportModalProps> = ({
  isOpen, onClose, onGenerateCards, onGenerateCardsFromImage, onGenerateTopicCards, onCardsCreated, onClassifyTopic,
  initialTopic, allPhrases, categories
}) => {
  const { t } = useTranslation();
  const { profile } = useLanguage();
  const [view, setView] = useState<View>('assistant');
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle');
  const [lang, setLang] = useState<LanguageCode>(profile.learning);

  const [transcript, setTranscript] = useState('');
  const [assistantInput, setAssistantInput] = useState('');

  const [proposedCards, setProposedCards] = useState<ProposedCard[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [canPaste, setCanPaste] = useState(false);
  const [categorySuggestion, setCategorySuggestion] = useState<{ name: string; existingCategory?: Category } | null>(null);
  const [generationOptions, setGenerationOptions] = useState<{ categoryId?: string; createCategoryName?: string } | undefined>();

  const [currentTopic, setCurrentTopic] = useState('');
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [refineText, setRefineText] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isRefineListening, setIsRefineListening] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [pendingCards, setPendingCards] = useState<ProposedCard[] | null>(null);
  const [editableCategoryName, setEditableCategoryName] = useState('');

  const [originalFileData, setOriginalFileData] = useState<{ mimeType: string, data: string } | null>(null);
  const [generationSource, setGenerationSource] = useState<'topic' | 'image' | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const assistantRecognitionRef = useRef<SpeechRecognition | null>(null);
  const refineRecognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');

  const generalCategory = categories.find(c => c.name.toLowerCase() === 'general');

  const reset = useCallback(() => {
    setView('assistant');
    setSpeechStatus('idle');
    setTranscript('');
    finalTranscriptRef.current = '';
    setAssistantInput('');
    setProposedCards([]);
    setSelectedIndices(new Set());
    setCategorySuggestion(null);
    setGenerationOptions(undefined);
    setCurrentTopic('');
    setShowRefineInput(false);
    setRefineText('');
    setIsRefining(false);
    setIsAdding(false);
    setPendingCards(null);
    setEditableCategoryName('');
    setOriginalFileData(null);
    setGenerationSource(null);
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    if (assistantRecognitionRef.current) {
      assistantRecognitionRef.current.abort();
    }
    if (refineRecognitionRef.current) {
      refineRecognitionRef.current.abort();
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      reset();
      if (initialTopic) {
        setView('assistant');
        setAssistantInput(initialTopic);
      }
    }
  }, [isOpen, reset, initialTopic]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      if (navigator.clipboard && navigator.permissions) {
        navigator.permissions.query({ name: 'clipboard-read' as PermissionName }).then(permissionStatus => {
          if (permissionStatus.state !== 'denied') setCanPaste(true); else setCanPaste(false);
          permissionStatus.onchange = () => { setCanPaste(permissionStatus.state !== 'denied'); };
        }).catch(() => { setCanPaste(true); });
      } else if (navigator.clipboard) {
        setCanPaste(true);
      } else {
        setCanPaste(false);
      }
    }
  }, [isOpen]);

  const generateAndPreview = useCallback(async (options: { source: 'topic', categoryOptions?: { categoryId?: string; createCategoryName?: string } }) => {
    setView('processing');
    setGenerationOptions(options.categoryOptions);
    setOriginalFileData(null);
    setGenerationSource('topic');
    try {
      let cards: ProposedCard[] = [];
      if (options.source === 'topic' && options.categoryOptions) {
        const topic = categorySuggestion?.name || assistantInput;
        setCurrentTopic(topic);
        let existingPhrases: string[] = [];
        if (options.categoryOptions.categoryId) {
          existingPhrases = allPhrases
            .filter(p => p.category === options.categoryOptions?.categoryId)
            .map(p => p.text.learning);
        }
        cards = await onGenerateTopicCards(topic, undefined, existingPhrases);
      }
      setProposedCards(cards);
      setSelectedIndices(new Set(cards.map((_, i) => i)));
      setView('preview');
    } catch (e) {
      console.error("Failed to generate cards:", e);
      onClose();
    }
  }, [allPhrases, onGenerateTopicCards, assistantInput, categorySuggestion, onClose]);

  const handleImageUpload = async (fileData: { mimeType: string, data: string }, refinement?: string) => {
    setView('processing');
    setOriginalFileData(fileData);
    setGenerationSource('image');
    try {
      const { cards, categoryName } = await onGenerateCardsFromImage(fileData, refinement);
      if (cards && cards.length > 0) {
        setPendingCards(cards);
        const existingCategory = categories.find(c => fuzzyService.isSimilar(c.name, [categoryName], 0.85));
        setCategorySuggestion({ name: categoryName, existingCategory });
        setEditableCategoryName(categoryName);
        setView('suggestion');
      } else {
        onClose();
      }
    } catch (e) {
      console.error("Failed to generate cards from image:", e);
      onClose();
    }
  };

  const handleSpeechTranscript = async () => {
    const finalTranscript = finalTranscriptRef.current.trim();
    if (!finalTranscript) return;
    setView('processing');
    try {
      const cards = await onGenerateCards(finalTranscript, lang);
      if (cards && cards.length > 0) {
        setPendingCards(cards);
        const suggestionName = t('modals.smartImport.categoryNames.fromSpeech');
        setCategorySuggestion({ name: suggestionName });
        setEditableCategoryName(suggestionName);
        setView('suggestion');
      } else {
        onClose();
      }
    } catch (e) {
      console.error("Failed to generate cards from speech:", e);
      onClose();
    }
  };

  const processPendingCards = (categoryOptions: { categoryId?: string; createCategoryName?: string }) => {
    if (!pendingCards) return;
    setGenerationOptions(categoryOptions);
    setProposedCards(pendingCards);
    setSelectedIndices(new Set(pendingCards.map((_, i) => i)));
    setCurrentTopic(''); // Clear topic as it's not from topic generation
    setView('preview');
    setPendingCards(null);
  };

  const handleProcessAssistantRequest = useCallback(async () => {
    if (!assistantInput.trim()) return;
    setView('classifying');

    const proposedCategoryName = assistantInput.trim();
    const existingCategory = categories.find(c => fuzzyService.isSimilar(c.name, [proposedCategoryName], 0.75));

    setCategorySuggestion({ name: proposedCategoryName, existingCategory });
    setEditableCategoryName(proposedCategoryName);
    setView('suggestion');
  }, [assistantInput, categories]);

  useEffect(() => {
    if (isOpen && initialTopic && assistantInput === initialTopic && view === 'assistant') {
      const timer = setTimeout(() => {
        handleProcessAssistantRequest();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialTopic, assistantInput, view, handleProcessAssistantRequest]);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = getSpeechLocale(lang);
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setSpeechStatus('recording');
      finalTranscriptRef.current = '';
      setTranscript('');
    };
    recognition.onend = () => {
      setSpeechStatus('stopped');
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setSpeechStatus('idle');
    };

    recognition.onresult = (event) => {
      const finalPart = Array.from(event.results).filter(result => result.isFinal).map(result => result[0].transcript).join('');
      const interimPart = Array.from(event.results).filter(result => !result.isFinal).map(result => result[0].transcript).join('');
      finalTranscriptRef.current = finalPart.trim();
      setTranscript((finalPart + interimPart).trim());
    };

    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, [lang]);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = getSpeechLocale(lang);
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Assistant speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setAssistantInput(transcript);
    };

    assistantRecognitionRef.current = recognition;
    return () => recognition.abort();
  }, []);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = getSpeechLocale(lang);
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsRefineListening(true);
    recognition.onend = () => setIsRefineListening(false);
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Refine speech recognition error:', event.error);
      setIsRefineListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map(result => result[0].transcript).join('');
      setRefineText(transcript);
    };

    refineRecognitionRef.current = recognition;
    return () => recognition.abort();
  }, []);

  const handlePasteFromClipboard = async () => {
    if (!navigator.clipboard) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        finalTranscriptRef.current = text.trim();
        setTranscript(text.trim());
        setSpeechStatus('stopped');
      }
    } catch (err) {
      console.error('Failed to paste from clipboard:', err);
      alert('Не удалось вставить текст из буфера обмена. Возможно, вы не предоставили разрешение.');
    }
  };

  const handleStartRecording = () => {
    if (recognitionRef.current && speechStatus !== 'recording') {
      try {
        setTranscript('');
        finalTranscriptRef.current = '';
        recognitionRef.current.start();
      } catch (e) { console.error("Could not start recognition:", e); }
    }
  };

  const handleStopRecording = () => {
    if (recognitionRef.current && speechStatus === 'recording') {
      recognitionRef.current.stop();
    }
  };

  const handleMicClickAssistant = () => {
    if (!assistantRecognitionRef.current) return;
    if (isListening) {
      assistantRecognitionRef.current.stop();
    } else {
      setAssistantInput('');
      assistantRecognitionRef.current.start();
    }
  };

  const handleRefineMicClick = () => {
    if (!refineRecognitionRef.current) return;
    if (isRefineListening) {
      refineRecognitionRef.current.stop();
    } else {
      refineRecognitionRef.current.start();
    }
  };

  const handleRefineTopic = async () => {
    if (!refineText.trim() || !currentTopic || isRefining) return;
    setIsRefining(true);
    try {
      const existingPhrases = allPhrases
        .filter(p => p.category === generationOptions?.categoryId)
        .map(p => p.text.learning);
      const cards = await onGenerateTopicCards(currentTopic, refineText, existingPhrases);
      setProposedCards(cards);
      setSelectedIndices(new Set(cards.map((_, i) => i)));
      setRefineText('');
      setShowRefineInput(false);
    } catch (e) {
      console.error("Failed to refine cards:", e);
    } finally {
      setIsRefining(false);
    }
  };

  const handleRefineImage = async () => {
    if (!refineText.trim() || !originalFileData || isRefining) return;
    setIsRefining(true);
    try {
      const { cards, categoryName } = await onGenerateCardsFromImage(originalFileData, refineText);
      setProposedCards(cards);
      setSelectedIndices(new Set(cards.map((_, i) => i)));
      const existingCategory = categories.find(c => fuzzyService.isSimilar(c.name, [categoryName], 0.85));
      setCategorySuggestion({ name: categoryName, existingCategory });
      setEditableCategoryName(categoryName);
      setRefineText('');
      setShowRefineInput(false);
    } catch (e) {
      console.error("Failed to refine cards from image:", e);
    } finally {
      setIsRefining(false);
    }
  };


  const toggleSelection = (index: number) => {
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(index)) { newSelection.delete(index); } else { newSelection.add(index); }
    setSelectedIndices(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === proposedCards.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(proposedCards.map((_, i) => i)));
    }
  };

  const handleAddSelected = async () => {
    setIsAdding(true);
    const selected = proposedCards.filter((_, i) => selectedIndices.has(i));
    await onCardsCreated(selected, generationOptions);
    onClose();
  };

  const renderSpeechContent = () => {
    const isRecording = speechStatus === 'recording';
    const isStopped = speechStatus === 'stopped';
    const currentTranscript = isRecording ? transcript : finalTranscriptRef.current.trim();

    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-m font-bold text-slate-100">{t('modals.smartImport.speech.title')}</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">{t('modals.smartImport.speech.subtitle')}</p>

        <div className="flex items-center space-x-2 bg-slate-700/50 rounded-full p-1 mb-4">
          <button onClick={() => setLang(profile.learning)} className={`px-4 py-1 text-sm font-bold rounded-full transition-colors ${lang === profile.learning ? 'bg-purple-600 text-white' : 'text-slate-300'}`}>
            {getLanguageLabel(profile.learning)}
          </button>
          <button onClick={() => setLang(profile.native)} className={`px-4 py-1 text-sm font-bold rounded-full transition-colors ${lang === profile.native ? 'bg-purple-600 text-white' : 'text-slate-300'}`}>
            {getLanguageLabel(profile.native)}
          </button>
        </div>

        <div className="w-full h-40 bg-slate-700/50 rounded-lg p-3 overflow-y-auto text-left text-slate-200 mb-4">
          {currentTranscript || <span className="italic text-sm text-slate-500">{t('modals.smartImport.speech.transcriptPlaceholder')}</span>}
        </div>

        <div className="flex items-center justify-center space-x-4">
          {!isRecording && canPaste && (
            <button onClick={handlePasteFromClipboard} className="p-3 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors text-white" aria-label={t('modals.smartImport.speech.aria.paste')}>
              <ClipboardIcon className="w-6 h-6" />
            </button>
          )}
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 ${isRecording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-purple-600 hover:bg-purple-700'}`}
          >
            <MicrophoneIcon className="w-10 h-10 text-white" />
          </button>
          {isStopped && (
            <button onClick={handleSpeechTranscript} className="p-3 rounded-full bg-green-600 hover:bg-green-700 transition-colors text-white" aria-label={t('modals.smartImport.speech.aria.process')}>
              <CheckIcon className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderAssistantContent = () => (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <h3 className="text-xl font-bold text-slate-300">{t('modals.smartImport.assistant.title')}</h3>
      <p className="text-sm text-slate-500 mt-1 mb-6">{t('modals.smartImport.assistant.subtitle')}</p>

      <div className="relative w-full max-w-md">
        <input
          type="text"
          value={assistantInput}
          onChange={e => setAssistantInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleProcessAssistantRequest(); }}
          placeholder={t('modals.smartImport.assistant.placeholder')}
          className="w-full bg-slate-700 border border-slate-600 rounded-full py-3 pl-5 pr-24 text-sm text-white placeholder-slate-500 italic focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          <button onClick={handleMicClickAssistant} className="p-2 transition-colors" aria-label={t('modals.smartImport.assistant.aria.microphone')}>
            <MicrophoneIcon className={`w-6 h-6 ${isListening ? 'text-purple-400' : 'text-slate-400 hover:text-white'}`} />
          </button>
          <button onClick={handleProcessAssistantRequest} className="p-2 bg-purple-600 hover:bg-purple-700 rounded-full text-white" aria-label={t('modals.smartImport.assistant.aria.generate')}>
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderSuggestionContent = () => {
    if (!categorySuggestion) return null;
    const { name, existingCategory } = categorySuggestion;
    const generalCategoryId = generalCategory?.id;

    const handleAddToGeneral = () => {
      const opts = generalCategoryId ? { categoryId: generalCategoryId } : {};
      if (pendingCards) { processPendingCards(opts); }
      else { generateAndPreview({ source: 'topic', categoryOptions: opts }); }
    };

    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <SmartToyIcon className="w-12 h-12 text-purple-400 mb-4" />
        {existingCategory ? (
          <>
            <h2 className="text-xl font-bold text-slate-100">{t('modals.smartImport.suggestion.addToExisting.title')}</h2>
            <p className="text-slate-400 mt-2 mb-6 max-w-sm">{t('modals.smartImport.suggestion.addToExisting.body', { category: existingCategory.name, topic: name })}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => {
                if (pendingCards) { processPendingCards({ categoryId: existingCategory.id }); }
                else { generateAndPreview({ source: 'topic', categoryOptions: { categoryId: existingCategory.id } }); }
              }} className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors text-white font-semibold">{t('modals.smartImport.suggestion.addToExisting.yes', { category: existingCategory.name })}</button>
              <button onClick={handleAddToGeneral} className="px-5 py-2.5 rounded-lg bg-slate-600 hover:bg-slate-700 transition-colors text-white font-semibold">{t('modals.smartImport.suggestion.addToExisting.no')}</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-slate-100">{t('modals.smartImport.suggestion.createNew.title')}</h2>
            <p className="text-slate-400 mt-2 mb-4 max-w-sm">{t('modals.smartImport.suggestion.createNew.body')}</p>
            <input
              type="text"
              value={editableCategoryName}
              onChange={e => setEditableCategoryName(e.target.value)}
              className="w-full max-w-xs bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 mb-6"
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => {
                if (editableCategoryName.trim()) {
                  if (pendingCards) { processPendingCards({ createCategoryName: editableCategoryName.trim() }); }
                  else { generateAndPreview({ source: 'topic', categoryOptions: { createCategoryName: editableCategoryName.trim() } }); }
                }
              }} className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors text-white font-semibold disabled:opacity-50" disabled={!editableCategoryName.trim()}>
                {t('modals.smartImport.suggestion.createNew.create')}
              </button>
              <button onClick={handleAddToGeneral} className="px-5 py-2.5 rounded-lg bg-slate-600 hover:bg-slate-700 transition-colors text-white font-semibold">{t('modals.smartImport.suggestion.createNew.addToGeneral')}</button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderPreviewContent = () => (
    <div className="flex flex-col h-full">
      <header className="flex-shrink-0 flex items-center justify-between pb-4">
        <div className="flex items-center min-w-0">
          <button
            onClick={() => setView('assistant')}
            className="p-2 -ml-2 rounded-full hover:bg-slate-700/80 transition-colors text-slate-300 hover:text-white"
            aria-label={t('modals.smartImport.preview.aria.back')}
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-slate-100 ml-2 truncate">{t('modals.smartImport.preview.title')}</h2>
        </div>
        <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-slate-700/80">
          <CloseIcon className="w-6 h-6 text-slate-400" />
        </button>
      </header>
      <div className="flex-grow overflow-y-auto hide-scrollbar -mx-6 px-6 min-h-0">
        <ul className="space-y-2">
          {proposedCards.map((card, index) => (
            <li key={index} onClick={() => toggleSelection(index)} className={`p-3 rounded-lg flex items-start space-x-3 cursor-pointer transition-colors ${selectedIndices.has(index) ? 'bg-slate-700' : 'bg-slate-700/50 hover:bg-slate-700/80'}`}>
              <div className={`mt-1 w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border-2 ${selectedIndices.has(index) ? 'bg-purple-600 border-purple-500' : 'bg-slate-800 border-slate-600'}`}>
                {selectedIndices.has(index) && <CheckIcon className="w-3 h-3 text-white" />}
              </div>
              <div>
                <p className="font-medium text-slate-200">{card.learning}</p>
                <p className="text-sm text-slate-400">{card.native}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <footer className="flex-shrink-0 pt-4 border-t border-slate-700 space-y-3">
        {showRefineInput && (
          <div className="flex items-center space-x-2">
            <div className="relative flex-grow">
              <input
                type="text"
                value={refineText}
                onChange={e => setRefineText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !isRefining) { generationSource === 'image' ? handleRefineImage() : handleRefineTopic(); } }}
                placeholder={t('modals.smartImport.preview.refine.placeholder')}
                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
              <button
                type="button"
                onClick={handleRefineMicClick}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white"
                aria-label={t('modals.smartImport.preview.refine.aria.microphone')}
              >
                <MicrophoneIcon className={`w-5 h-5 ${isRefineListening ? 'text-purple-400' : ''}`} />
              </button>
            </div>
            <button onClick={generationSource === 'image' ? handleRefineImage : handleRefineTopic} disabled={!refineText.trim() || isRefining} className="p-2 w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-md bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors disabled:opacity-50">
              {isRefining ? <Spinner className="w-5 h-5" /> : <RefreshIcon className="w-5 h-5" />}
            </button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <button onClick={toggleSelectAll} className="px-2 sm:px-4 py-2 text-sm rounded-md text-slate-300 hover:bg-slate-700 transition-colors">
            {selectedIndices.size === proposedCards.length ? t('modals.smartImport.preview.actions.clearAll') : t('modals.smartImport.preview.actions.selectAll')}
          </button>
          <div className="flex items-center space-x-2">
            {!showRefineInput && generationSource && (
              <button onClick={() => setShowRefineInput(true)} className="px-3 sm:px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold transition-colors flex items-center">
                <PencilIcon className="w-5 h-5 sm:mr-2" />
                <span className="hidden sm:inline">{t('modals.smartImport.preview.actions.refine')}</span>
              </button>
            )}
            <button onClick={handleAddSelected} disabled={selectedIndices.size === 0 || isAdding} className="px-4 sm:px-6 py-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center min-w-[120px]">
              {isAdding ? <Spinner className="w-5 h-5" /> : (
                <>
                  <span className="sm:hidden">+</span>
                  <span className="hidden sm:inline">{t('modals.smartImport.preview.actions.add')}</span>
                  <span> ({selectedIndices.size})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );

  const renderCurrentView = () => {
    switch (view) {
      case 'assistant': return renderAssistantContent();
      case 'speech': return renderSpeechContent();
      case 'file': return <FileImportView onProcessFile={handleImageUpload} />;
      case 'classifying':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <Spinner />
            <p className="mt-4 text-slate-300">{t('modals.smartImport.processing.analyzingTopic')}</p>
          </div>
        );
      case 'processing':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="mb-4 text-lg text-slate-300">{t('modals.smartImport.processing.generatingCards')}</p>
            <CardListSkeleton />
          </div>
        );
      case 'suggestion': return renderSuggestionContent();
      case 'preview': return renderPreviewContent();
      default: return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[80] flex justify-center items-center backdrop-blur-sm p-4 animate-fade-in" onClick={isAdding ? undefined : onClose}>
      <div className="relative w-full max-w-2xl min-h-[34rem] h-[80vh] max-h-[600px] bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl flex flex-col p-6" onClick={e => e.stopPropagation()}>
        {(view === 'preview') ? null : <CloseIcon className="w-6 h-6 text-slate-400 absolute top-4 right-4 cursor-pointer hover:text-white" onClick={onClose} />}

        {(view === 'assistant' || view === 'speech' || view === 'file') && (
          <div className="flex-shrink-0 flex items-center justify-center space-x-2 bg-slate-900/50 rounded-full p-1 self-center mb-6">
            <button onClick={() => setView('assistant')} className={`p-3 sm:py-2 sm:px-4 text-sm font-bold rounded-full transition-colors flex items-center space-x-2 ${view === 'assistant' ? 'bg-purple-600 text-white' : 'text-slate-300'}`}>
              <SmartToyIcon className="w-5 h-5" />
              <span className="hidden sm:inline">{t('modals.smartImport.tabs.assistant')}</span>
            </button>
            <button onClick={() => setView('speech')} className={`p-3 sm:py-2 sm:px-4 text-sm font-bold rounded-full transition-colors flex items-center space-x-2 ${view === 'speech' ? 'bg-purple-600 text-white' : 'text-slate-300'}`}>
              <MicrophoneIcon className="w-5 h-5" />
              <span className="hidden sm:inline">{t('modals.smartImport.tabs.speech')}</span>
            </button>
            <button onClick={() => setView('file')} className={`p-3 sm:py-2 sm:px-4 text-sm font-bold rounded-full transition-colors flex items-center space-x-2 ${view === 'file' ? 'bg-purple-600 text-white' : 'text-slate-300'}`}>
              <ImageIcon className="w-5 h-5" />
              <span className="hidden sm:inline">{t('modals.smartImport.tabs.file')}</span>
            </button>
          </div>
        )}

        <div className="flex-grow min-h-0">
          {renderCurrentView()}
        </div>
      </div>
    </div>
  );
};

export default SmartImportModal;
