import fs from "node:fs"
import path from "node:path"
import assert from "node:assert/strict"

const root = process.cwd()

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

function assertIncludes(source: string, text: string, file: string) {
  assert.ok(source.includes(text), `${file} must include ${text}`)
}

const badge = read("src/components/ui/product-status-badge.tsx")
assertIncludes(badge, 'status: "beta"', "product-status-badge.tsx")
assertIncludes(badge, "BETA", "product-status-badge.tsx")
assertIncludes(badge, "aria-label", "product-status-badge.tsx")
assert.ok(!/red-|orange-|amber-/.test(badge), "ProductStatusBadge must not use warning colors")

const hybridButton = read("src/components/ui/hybrid-ai-button.tsx")
assertIncludes(hybridButton, "ProductStatusBadge", "hybrid-ai-button.tsx")
assertIncludes(hybridButton, "Choose your AI mode", "hybrid-ai-button.tsx")
assertIncludes(hybridButton, "Your data. Your choice.", "hybrid-ai-button.tsx")
assertIncludes(hybridButton, "Cloud AI", "hybrid-ai-button.tsx")
assertIncludes(hybridButton, "Local AI", "hybrid-ai-button.tsx")
assertIncludes(hybridButton, "Local AI is in beta. Performance and compatibility depend on your system configuration.", "hybrid-ai-button.tsx")
assert.ok(!/title="Cloud AI"[\s\S]{0,240}<ProductStatusBadge/.test(hybridButton), "Cloud AI card must not receive a beta badge")

const helperChat = read("src/components/hybrid-ai/useclevr-hybrid-ai-chat-panel.tsx")
assertIncludes(helperChat, "UseClevr Local AI", "useclevr-hybrid-ai-chat-panel.tsx")
assertIncludes(helperChat, "connectionStatusLabel", "useclevr-hybrid-ai-chat-panel.tsx")
assertIncludes(helperChat, "Start the UseClevr Helper or connect a supported local AI provider to use private local analysis.", "useclevr-hybrid-ai-chat-panel.tsx")
assertIncludes(helperChat, "AiAccuracyDisclaimer", "useclevr-hybrid-ai-chat-panel.tsx")

const byoaiChat = read("src/components/hybrid-ai/byoai-hybrid-chat.tsx")
assertIncludes(byoaiChat, "Local AI <ProductStatusBadge status=\"beta\" /> depends on your provider and system configuration.", "byoai-hybrid-chat.tsx")
assertIncludes(byoaiChat, "AiAccuracyDisclaimer", "byoai-hybrid-chat.tsx")

const helperModal = read("src/components/modals/mega-installer-modal.tsx")
assertIncludes(helperModal, "Local AI Providers", "mega-installer-modal.tsx")
assertIncludes(helperModal, "UseClevr Helper", "mega-installer-modal.tsx")
assertIncludes(helperModal, "ProductStatusBadge", "mega-installer-modal.tsx")
assertIncludes(helperModal, "Downloads are coming soon and stay disabled until signed binaries are available.", "mega-installer-modal.tsx")

const aiProviders = read("src/app/(auth)/app/settings/ai-providers/ai-providers-client.tsx")
assertIncludes(aiProviders, "Local AI Providers", "ai-providers-client.tsx")
assertIncludes(aiProviders, "localProviderCount", "ai-providers-client.tsx")
assertIncludes(aiProviders, "Start the UseClevr Helper or connect a supported local AI provider to use private local analysis.", "ai-providers-client.tsx")
assert.ok(!/title="UseClevr Cloud"[\s\S]{0,240}<ProductStatusBadge/.test(aiProviders), "UseClevr Cloud mode must not receive a beta badge")

const usy = read("src/components/ui/help-chatbox.tsx")
assertIncludes(usy, "Powered by UseClevr AI", "help-chatbox.tsx")
assert.ok(!usy.includes("Powered by UseClevr Hybrid AI"), "Usy composer must not imply all Usy answers are Local AI beta")

const publicHeader = read("src/components/layout/public-header.tsx")
assertIncludes(publicHeader, "ProductStatusBadge", "public-header.tsx")
assertIncludes(publicHeader, "Local AI is in beta. Performance and compatibility depend on your system configuration.", "public-header.tsx")
assert.ok(!/Cloud AI[\s\S]{0,240}<ProductStatusBadge/.test(publicHeader), "Public Cloud AI label must not receive a beta badge")

console.log("Local AI beta status checks passed.")
