import ePub from 'epubjs';
import React, { useEffect, useState } from 'react';

import PlusIcon from '../components/icons/PlusIcon';
import { useTranslation } from '../hooks/useTranslation.ts';
import * as dbService from '../services/dbService.ts';
import { Book, BookRecord } from '../types.ts';

interface LibraryPageProps {
  onOpenBook: (bookId: number) => void;
}

const LibraryPageSkeleton: React.FC = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-pulse">
    {[...Array(5)].map((_, i) => (
      <div key={i}>
        <div className="aspect-[2/3] bg-slate-700 rounded-lg"></div>
        <div className="mt-2 h-4 bg-slate-700 rounded w-3/4"></div>
        <div className="mt-1 h-3 bg-slate-700 rounded w-1/2"></div>
      </div>
    ))}
  </div>
);

const LibraryPage: React.FC<LibraryPageProps> = ({ onOpenBook }) => {
  const { t } = useTranslation();
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingBook, setIsAddingBook] = useState(false);

  const loadBooks = async () => {
    setIsLoading(true);
    const storedBooks = await dbService.getAllBooks();
    const bookRecords = storedBooks.map((book) => ({
      ...book,
      id: book.id!,
      coverUrl: URL.createObjectURL(book.coverBlob),
    }));
    setBooks(bookRecords);
    setIsLoading(false);
  };

  useEffect(() => {
    loadBooks();

    return () => {
      books.forEach((book) => URL.revokeObjectURL(book.coverUrl));
    };
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAddingBook(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const book = ePub(arrayBuffer);
      const metadata = await book.loaded.metadata;

      let coverBlob: Blob = new Blob();
      try {
        const coverUrl = await book.coverUrl();
        if (coverUrl) {
          const coverResponse = await fetch(coverUrl);
          coverBlob = await coverResponse.blob();
        } else {
          throw new Error('No cover URL found.');
        }
      } catch (coverError) {
        console.warn('Could not load book cover, creating placeholder:', coverError);
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 450;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, 0, 300, 450);
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.font = '24px sans-serif';
        const words = metadata.title.split(' ');
        let line = '';
        let y = 180;
        for (let n = 0; n < words.length; n++) {
          let testLine = line + words[n] + ' ';
          if (ctx.measureText(testLine).width > 260 && n > 0) {
            ctx.fillText(line, 150, y);
            line = words[n] + ' ';
            y += 30;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, 150, y);

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) coverBlob = blob;
      }

      const newBook: Book = {
        title: metadata.title,
        author: metadata.creator,
        coverBlob,
        epubData: arrayBuffer,
        lastLocation: null,
      };

      await dbService.addBook(newBook);
      await loadBooks(); // Reload all books to get the new one with its ID
    } catch (error) {
      console.error('Error processing EPUB file:', error);
      alert(t('library.notifications.epubProcessingFailed'));
    } finally {
      setIsAddingBook(false);
      event.target.value = ''; // Reset file input
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 animate-fade-in">
      {isLoading ? (
        <LibraryPageSkeleton />
      ) : books.length === 0 ? (
        <div className="text-center text-slate-400 py-16">
          <h2 className="text-2xl font-bold text-white mb-4">{t('library.empty.title')}</h2>
          <p className="mb-6">{t('library.empty.description')}</p>
          <label className="inline-flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-md text-white font-bold transition-colors cursor-pointer">
            <PlusIcon className="w-5 h-5 mr-2" />
            <span>{t('library.empty.action')}</span>
            <input type="file" accept=".epub" className="hidden" onChange={handleFileChange} />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {books.map((book) => (
            <div key={book.id} className="cursor-pointer group" onClick={() => onOpenBook(book.id)}>
              <div className="aspect-[2/3] bg-slate-700 rounded-lg overflow-hidden shadow-lg transform transition-transform group-hover:scale-105">
                <img
                  src={book.coverUrl}
                  alt={t('library.alt.cover', { title: book.title })}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="mt-2 text-sm font-semibold text-slate-100 truncate">{book.title}</h3>
              <p className="text-xs text-slate-400 truncate">{book.author}</p>
            </div>
          ))}
          <label className="relative aspect-[2/3] bg-slate-800/50 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:bg-slate-700/50 hover:border-purple-500 transition-colors cursor-pointer">
            {isAddingBook ? (
              <div className="flex space-x-1 items-center justify-center text-slate-300">
                <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              </div>
            ) : (
              <PlusIcon className="w-10 h-10" />
            )}
            <span className="mt-2 text-sm font-semibold">
              {isAddingBook ? t('library.actions.adding') : t('library.cards.add')}
            </span>
            <input
              type="file"
              accept=".epub"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
              disabled={isAddingBook}
            />
          </label>
        </div>
      )}
    </div>
  );
};

export default LibraryPage;
