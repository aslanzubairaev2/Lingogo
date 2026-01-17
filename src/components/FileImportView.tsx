import Cropper from 'cropperjs';
import React, { useEffect, useRef, useState } from 'react';

import { useLanguage } from '../contexts/languageContext';
import { useTranslation } from '../hooks/useTranslation';
import { getNativeSpeechLocale } from '../services/speechService';
import CameraCaptureModal from './CameraCaptureModal';
import CameraIcon from './icons/CameraIcon';
import CheckIcon from './icons/CheckIcon';
import CloseIcon from './icons/CloseIcon';
import FilePlusIcon from './icons/FilePlusIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import WandIcon from './icons/WandIcon';
import XCircleIcon from './icons/XCircleIcon';

interface ImageCropperModalProps {
  isOpen: boolean;
  src: string | null;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}

const ImageCropperModal: React.FC<ImageCropperModalProps> = ({ isOpen, src, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const imageRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<Cropper | null>(null);

  useEffect(() => {
    if (isOpen && src && imageRef.current) {
      cropperRef.current = new Cropper(imageRef.current);
    }

    return () => {
      if (cropperRef.current) {
        cropperRef.current.destroy();
        cropperRef.current = null;
      }
    };
  }, [isOpen, src]);

  const handleConfirm = async () => {
    if (cropperRef.current) {
      const canvas = await cropperRef.current.getCropperCanvas().$toCanvas();
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      onConfirm(dataUrl);
    }
  };

  if (!isOpen || !src) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full h-full max-w-4xl max-h-[80vh]">
        <img ref={imageRef} src={src} className="block w-full h-full" alt="Image to crop" />
      </div>
      <div className="mt-4 flex items-center space-x-4">
        <button
          onClick={onCancel}
          className="px-6 py-3 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-semibold transition-colors flex items-center"
        >
          <CloseIcon className="w-5 h-5 mr-2" />
          <span>{t('modals.fileImport.cropper.cancel')}</span>
        </button>
        <button
          onClick={handleConfirm}
          className="px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors flex items-center"
        >
          <CheckIcon className="w-5 h-5 mr-2" />
          <span>{t('modals.fileImport.cropper.confirm')}</span>
        </button>
      </div>
    </div>
  );
};

interface FileImportViewProps {
  onProcessFile: (fileData: { mimeType: string; data: string }, refinement?: string) => void;
}

const FileImportView: React.FC<FileImportViewProps> = ({ onProcessFile }) => {
  const { t } = useTranslation();
  const { profile } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [refinement, setRefinement] = useState('');
  const [isRefineListening, setIsRefineListening] = useState(false);
  const refineRecognitionRef = useRef<SpeechRecognition | null>(null);

  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [croppedImageSrc, setCroppedImageSrc] = useState<string | null>(null);
  const [croppedImageData, setCroppedImageData] = useState<{ mimeType: string; data: string } | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognition();
      recognition.lang = getNativeSpeechLocale(profile);
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onstart = () => setIsRefineListening(true);
      recognition.onend = () => setIsRefineListening(false);
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Refine speech recognition error:', event.error);
        setIsRefineListening(false);
      };
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join('');
        setRefinement(transcript);
      };
      refineRecognitionRef.current = recognition;
    }
  }, []);

  const clearFile = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setFile(null);
    setError(null);
    setRefinement('');
    setIsCropperOpen(false);
    setImageToCrop(null);
    setCroppedImageSrc(null);
    setCroppedImageData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (selectedFile: File | null) => {
    clearFile();
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      setError(t('modals.fileImport.errors.unsupportedType'));
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      // 10MB limit
      setError(t('modals.fileImport.errors.tooLarge'));
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageToCrop(e.target?.result as string);
      setIsCropperOpen(true);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleSubmit = async () => {
    if (!croppedImageData) {
      setError(t('modals.fileImport.errors.cropFirst'));
      return;
    }
    onProcessFile(croppedImageData, refinement.trim() || undefined);
  };

  const handleMicClick = () => {
    if (!refineRecognitionRef.current) return;
    if (isRefineListening) {
      refineRecognitionRef.current.stop();
    } else {
      refineRecognitionRef.current.start();
    }
  };

  const handleDragEvents = (e: React.DragEvent<HTMLLabelElement>, isEntering: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(isEntering);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    handleDragEvents(e, false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileChange(droppedFile);
    }
  };

  const handleCropConfirm = (dataUrl: string) => {
    setCroppedImageSrc(dataUrl);
    const base64Data = dataUrl.split(',')[1];
    setCroppedImageData({ mimeType: 'image/jpeg', data: base64Data });
    setIsCropperOpen(false);
    setImageToCrop(null);
  };

  const handleCropCancel = () => {
    clearFile();
  };

  const handleCapture = (dataUrl: string) => {
    setIsCameraOpen(false);
    setImageToCrop(dataUrl);
    setIsCropperOpen(true);
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center h-full text-center">
        {!croppedImageSrc ? (
          <>
            <p className="text-sm italic text-slate-600 -mt-4 mb-4 max-w-md">{t('modals.fileImport.instructions')}</p>
            <input
              ref={fileInputRef}
              type="file"
              id="file-upload"
              className="hidden"
              accept="image/*"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />
            <div className="w-[90%]  h-[85%] grid grid-cols-1 sm:grid-cols-2 gap-4 ">
              <label
                htmlFor="file-upload"
                onDragEnter={(e) => handleDragEvents(e, true)}
                onDragLeave={(e) => handleDragEvents(e, false)}
                onDragOver={(e) => handleDragEvents(e, true)}
                onDrop={handleDrop}
                className={`py-5 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging ? 'border-purple-500 bg-slate-700' : 'border-slate-600 hover:border-slate-500'}`}
              >
                <FilePlusIcon className="w-5 h-5 text-slate-600 mb-2" />
                <span className="text-sm font-semibold text-slate-300">{t('modals.fileImport.dropzone.text')}</span>
                <span className="text-sm text-slate-600 mt-1">{t('modals.fileImport.dropzone.subtext')}</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="py-5 border-2 border-dashed border-slate-600 hover:border-slate-500 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors"
              >
                <CameraIcon className="w-5 h-5 text-slate-500 mb-2" />
                <span className="font-semibold text-slate-300">{t('modals.fileImport.camera.button')}</span>
                <span className="text-xs text-slate-600 mt-1">{t('modals.fileImport.camera.subtext')}</span>
              </button>
            </div>
          </>
        ) : (
          <div className="w-full flex flex-col items-center">
            <div className="w-full h-48 bg-slate-700/50 rounded-lg p-1 flex items-center justify-center relative mb-4">
              <button
                onClick={clearFile}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white/70 hover:text-white transition-colors z-10"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
              <img
                src={croppedImageSrc}
                alt={t('modals.fileImport.preview.alt')}
                className="max-w-full max-h-full object-contain rounded-md"
              />
            </div>
            <div className="relative w-full max-w-md mt-4">
              <textarea
                value={refinement}
                onChange={(e) => setRefinement(e.target.value)}
                placeholder={t('modals.fileImport.refinement.placeholder')}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 pr-12 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors resize-none"
                rows={2}
              />
              <button
                type="button"
                onClick={handleMicClick}
                className="absolute top-2 right-2 p-2 text-slate-400 hover:text-white"
                aria-label={t('modals.fileImport.refinement.aria')}
              >
                <MicrophoneIcon className={`w-5 h-5 ${isRefineListening ? 'text-purple-400' : ''}`} />
              </button>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!croppedImageData}
              className="mt-4 w-full max-w-xs px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold transition-colors shadow-md flex items-center justify-center disabled:opacity-50"
            >
              <WandIcon className="w-5 h-5 mr-2" />
              <span>{t('modals.fileImport.submit')}</span>
            </button>
          </div>
        )}
        {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
      </div>
      <ImageCropperModal
        isOpen={isCropperOpen}
        src={imageToCrop}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
      <CameraCaptureModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCapture} />
    </>
  );
};

export default FileImportView;
