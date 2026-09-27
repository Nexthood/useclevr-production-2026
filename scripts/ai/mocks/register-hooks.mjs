import { registerHooks, register } from "node:module"
import { resolve } from "./hooks.mjs"

if (typeof registerHooks === "function") {
  registerHooks({ resolve })
} else {
  register("./hooks.mjs", import.meta.url)
}
