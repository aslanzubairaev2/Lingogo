import { DBSchema, IDBPDatabase, openDB } from 'idb';

import { BookRecord } from '../types.ts';

/**
 * Interface representing the database schema for the application.
 * Extends `DBSchema` from 'idb' to provide type safety for IndexedDB operations.
 */
interface AppDB extends DBSchema {
  /**
   * 'books' store for storing e-book content and metadata.
   */
  books: {
    /** The primary key is the auto-incremented book ID. */
    key: number;
    /** The value stored is a `BookRecord` object. */
    value: BookRecord;
    /** Indexes available for querying. */
    indexes: {
      /** Index to query books by their title. */
      title: string;
    };
  };
}

const DB_NAME = 'LearningSRSLibraryDB';
const DB_VERSION = 1;
const STORE_NAME = 'books';

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

/**
 * Initializes the IndexedDB database.
 * Creates the database structure and object stores if they don't exist or need upgrading.
 * 
 * @returns {Promise<IDBPDatabase<AppDB>>} A promise that resolves to the database instance.
 */
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

/**
 * Adds a new book to the library.
 * 
 * @param {BookRecord} book The book record to add.
 * @returns {Promise<number>} A promise resolving to the ID of the new book.
 */
export const addBook = async (book: BookRecord): Promise<number> => {
  const db = await initDB();
  return db.add(STORE_NAME, book);
};

/**
 * Retrieves all books from the library.
 * 
 * @returns {Promise<BookRecord[]>} A promise resolving to an array of all book records.
 */
export const getAllBooks = async (): Promise<BookRecord[]> => {
  const db = await initDB();
  return db.getAll(STORE_NAME);
};

/**
 * Retrieves a specific book by its ID.
 * 
 * @param {number} id The ID of the book to retrieve.
 * @returns {Promise<BookRecord | undefined>} A promise resolving to the book record if found, or undefined.
 */
export const getBook = async (id: number): Promise<BookRecord | undefined> => {
  const db = await initDB();
  return db.get(STORE_NAME, id);
};

/**
 * Updates the last read location (CFI) for a specific book.
 * 
 * @param {number} id The ID of the book to update.
 * @param {string} lastLocation The new CFI location string.
 * @returns {Promise<void>} A promise that resolves when the update is complete.
 */
export const updateBookLocation = async (id: number, lastLocation: string): Promise<void> => {
  const db = await initDB();
  const book = await db.get(STORE_NAME, id);
  if (book) {
    book.lastLocation = lastLocation;
    await db.put(STORE_NAME, book);
  }
};
