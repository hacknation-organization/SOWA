import { createHttpClient, type ApiClient } from "./client";
import { createMockClient } from "./mock";

export * from "./types";
export { ApiError, SESSION_STORAGE_KEY } from "./client";
export type { ApiClient } from "./client";

const baseUrl = process.env.NEXT_PUBLIC_API_URL;

export const API_MODE: "api" | "mock" = baseUrl ? "api" : "mock";

export const api: ApiClient = baseUrl ? createHttpClient(baseUrl) : createMockClient();
