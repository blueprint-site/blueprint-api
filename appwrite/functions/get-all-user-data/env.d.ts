declare global {
  namespace NodeJS {
    interface ProcessEnv {
      APPWRITE_DATABASE_ID: string;
    }
  }
}

export {};
