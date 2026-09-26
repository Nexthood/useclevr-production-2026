import { registerHooks, register } from "node:module";
import { resolve } from "./hooks-entitlement.mjs";

if (typeof registerHooks === "function") {
  registerHooks({ resolve });
} else {
  register("./hooks-entitlement.mjs", import.meta.url);
}
