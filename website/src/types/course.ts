export type Chapter = { title: string; done: boolean };

export type Course = { id: number; name: string; chapters: Chapter[] };
