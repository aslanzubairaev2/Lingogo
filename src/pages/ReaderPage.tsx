import ePub, { Rendition } from 'epubjs';
import React, { useEffect, useRef, useState } from 'react';

import ArrowLeftIcon from '../components/icons/ArrowLeftIcon';
import ArrowRightIcon from '../components/icons/ArrowRightIcon';
import CloseIcon from '../components/icons/CloseIcon';
import * as dbService from '../services/dbService';

const SWIPE_THRESHOLD = 50;

interface ReaderPageProps {
  bookId: number;
  onClose: () => void;
}

const ReaderPageSkeleton: React.FC = () => (
  <div className="w-full h-full p-8 sm:p-12 md:p-16 animate-pulse">
    <div className="space-y-4 max-w-prose mx-auto">
      <div className="h-5 bg-slate-700 rounded w-3/4"></div>
      <div className="h-4 bg-slate-700 rounded w-full"></div>
      <div className="h-4 bg-slate-700 rounded w-full"></div>
      <div className="h-4 bg-slate-700 rounded w-5/6"></div>
      <div className="h-4 bg-slate-700 rounded w-full"></div>
      <div className="h-4 bg-slate-700 rounded w-1/2 mt-4"></div>
      <div className="h-4 bg-slate-700 rounded w-full pt-8"></div>
      <div className="h-4 bg-slate-700 rounded w-full"></div>
      <div className="h-4 bg-slate-700 rounded w-2/3"></div>
    </div>
  </div>
);

// FIX: Added debounce function to resolve error.
const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced;
};

// FIX: Export the component to make it available for import in other modules.
// FIX: Completed the component implementation, adding the useEffect logic and a JSX return statement to fix the "not assignable to type 'FC'" error.
export const ReaderPage: React.FC<ReaderPageProps> = ({ bookId, onClose }) => {
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [bookTitle, setBookTitle] = useState('');

  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<ePub.Book | null>(null);
  const touchStartRef = useRef<number | null>(null);

  // --- Загружаем книгу

  useEffect(() => {
    let renditionInstance: Rendition | null = null;
    let bookInstance: ePub.Book | null = null;

    const loadBook = async () => {
      try {
        const bookData = await dbService.getBook(bookId);
        if (!bookData || !viewerRef.current) {
          throw new Error('Book not found or viewer not ready.');
        }

        bookInstance = ePub(bookData.epubData);
        bookRef.current = bookInstance;

        const metadata = await bookInstance.loaded.metadata;
        setBookTitle(metadata.title);

        renditionInstance = bookInstance.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'auto',
          manager: 'continuous',
          snap: true,
        });

        setRendition(renditionInstance);

        const handleLocationChanged = debounce(async (location: any) => {
          const cfi = location.start.cfi;
          if (cfi) {
            await dbService.updateBookLocation(bookId, cfi);
          }
          if (bookInstance?.locations) {
            const current = bookInstance.locations.locationFromCfi(cfi);
            if (current !== null) {
              const total = bookInstance.locations.total;
              const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
              setProgress(percentage);
            }
          }
        }, 500);

        renditionInstance.on('relocated', handleLocationChanged);

        await bookInstance.ready;
        await bookInstance.locations.generate(1650);

        if (bookData.lastLocation) {
          await renditionInstance.display(bookData.lastLocation);
        } else {
          await renditionInstance.display();
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading book:', error);
        setIsLoading(false);
      }
    };

    loadBook();

    return () => {
      bookInstance?.destroy();
      renditionInstance?.destroy();
      bookRef.current = null;
      setRendition(null);
    };
  }, [bookId]);

  const goPrev = () => rendition?.prev();
  const goNext = () => rendition?.next();

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.targetTouches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current !== null) {
      const deltaX = e.changedTouches[0].clientX - touchStartRef.current;
      if (deltaX < -SWIPE_THRESHOLD) goNext();
      else if (deltaX > SWIPE_THRESHOLD) goPrev();
    }
    touchStartRef.current = null;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="w-full h-full fixed inset-0 bg-slate-900 z-40 flex flex-col font-serif animate-fade-in">
      <header className="flex-shrink-0 w-full p-3 flex justify-between items-center z-50 bg-slate-800/80 backdrop-blur-sm border-b border-slate-700">
        <div className="flex-grow w-1/3 text-left">
          <h1 className="text-sm text-slate-300 truncate">{bookTitle}</h1>
        </div>
        <div className="flex-grow w-1/3 text-center text-sm text-slate-300">{progress}%</div>
        <div className="flex-grow w-1/3 flex justify-end">
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Закрыть книгу"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="flex-grow relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <style>{`
                    .reader-container iframe {
                        color-scheme: dark;
                    }
                `}</style>
        <div ref={viewerRef} id="viewer" className="w-full h-full reader-container">
          {isLoading && <ReaderPageSkeleton />}
        </div>

        {!isLoading && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-0 top-0 h-full w-1/4 z-10"
              aria-label="Previous Page"
            ></button>
            <button
              onClick={goNext}
              className="absolute right-0 top-0 h-full w-1/4 z-10"
              aria-label="Next Page"
            ></button>
          </>
        )}
      </div>

      <footer className="flex-shrink-0 w-full p-2 flex justify-between items-center z-50 bg-slate-800/80 backdrop-blur-sm border-t border-slate-700">
        <button
          onClick={goPrev}
          className="p-3 text-slate-400 hover:text-white transition-colors"
          aria-label="Предыдущая страница"
        >
          <ArrowLeftIcon className="w-6 h-6" />
        </button>
        <button
          onClick={goNext}
          className="p-3 text-slate-400 hover:text-white transition-colors"
          aria-label="Следующая страница"
        >
          <ArrowRightIcon className="w-6 h-6" />
        </button>
      </footer>
    </div>
  );
};
