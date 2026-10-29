import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { createApi } from "./api.js";
export const api = createApi(env, getChatGPTUser);
