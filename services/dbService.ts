import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Book } from '../types';

interface AppDB extends DBSchema {
  books: {
    key: number;
    value: Book;
    indexes: { title: string };
  };
}

const DB_NAME = 'LearningSRSLibraryDB';
const DB_VERSION = 1;
const STORE_NAME = 'books';

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

const initDB = () => {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('title', 'title');
      }
    },
  });
  return dbPromise;
};

export const addBook = async (book: Book): Promise<number> => {
  const db = await initDB();
  return db.add(STORE_NAME, book);
};

export const getAllBooks = async (): Promise<Book[]> => {
  const db = await initDB();
  return db.getAll(STORE_NAME);
};

export const getBook = async (id: number): Promise<Book | undefined> => {
  const db = await initDB();
  return db.get(STORE_NAME, id);
};

export const updateBookLocation = async (id: number, lastLocation: string): Promise<void> => {
  const db = await initDB();
  const book = await db.get(STORE_NAME, id);
  if (book) {
    await db.put(STORE_NAME, { ...book, lastLocation });
  }
};
