import { ModelInit, MutableModel, PersistentModelConstructor } from "@aws-amplify/datastore";





type BookMetaData = {
  readOnlyFields: 'createdAt' | 'updatedAt';
}

export declare class Book {
  readonly id: string;
  readonly name?: string | null;
  readonly description?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  constructor(init: ModelInit<Book, BookMetaData>);
  static copyOf(source: Book, mutator: (draft: MutableModel<Book, BookMetaData>) => MutableModel<Book, BookMetaData> | void): Book;
}