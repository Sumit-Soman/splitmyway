export type Bindings = {
  DB: D1Database;
  /** Same value as Next.js `WORKER_JWT_SECRET`. */
  JWT_SECRET: string;
  CORS_ORIGINS?: string;
};

export type HonoEnv = {
  Bindings: Bindings;
  Variables: {
    userId: string;
    userEmail: string;
  };
};
