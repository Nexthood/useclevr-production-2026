import { registerHooks, register } from "node:module"
import { resolve } from "./hooks-subscription.mjs"

if (typeof registerHooks === "function") {
  registerHooks({ resolve })
} else {
  register("./hooks-subscription.mjs", import.meta.url)
}
