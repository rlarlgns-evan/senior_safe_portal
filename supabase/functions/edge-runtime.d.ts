/** Supabase Edge Functions — Deno 런타임 (로컬 IDE 타입 힌트용) */
declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  env: {
    get(key: string): string | undefined;
  };
};
