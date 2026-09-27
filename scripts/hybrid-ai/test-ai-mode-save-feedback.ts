import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  getAiModeSuccessFeedback,
  initialAiModeUiState,
  resolveAiModeSaveState,
  resolveByokActiveProvider,
  type PublicAiMode,
} from "../../src/lib/hybrid-ai/ai-mode-save-state"

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

function assertIncludes(source: string, expected: string, message: string) {
  assert.ok(source.includes(expected), message)
}

function assertNotIncludes(source: string, forbidden: string, message: string) {
  assert.equal(source.includes(forbidden), false, message)
}

const byokProvider = { providerName: "OpenAI", modelName: "gpt-4o-mini" }

function saved(mode: PublicAiMode) {
  return { success: true as const, savedMode: mode }
}

function failed(error: string) {
  return { success: false as const, error }
}

// 1. Cloud -> BYOK successful save moves Active and reports provider/model.
const cloudToByok = resolveAiModeSaveState({
  activeMode: "useclevr_cloud",
  selectedMode: "byok",
  outcome: saved("byok"),
  activeProvider: byokProvider,
})
assert.equal(cloudToByok.activeMode, "byok", "Cloud -> BYOK save moves the Active badge to BYOK")
assert.equal(cloudToByok.selectedMode, "byok", "Cloud -> BYOK save keeps the selection on BYOK")
assert.equal(cloudToByok.feedback?.title, "AI mode changed to BYOK", "BYOK success title is mode-specific")
assert.equal(cloudToByok.feedback?.message, "OpenAI · gpt-4o-mini is now your active provider.", "BYOK success names provider and model")
assert.equal(cloudToByok.feedback?.message.includes("sk-"), false, "BYOK success never includes API key material")

// 2. BYOK -> Cloud successful save moves Active to UseClevr Cloud.
const byokToCloud = resolveAiModeSaveState({
  activeMode: "byok",
  selectedMode: "useclevr_cloud",
  outcome: saved("useclevr_cloud"),
  activeProvider: byokProvider,
})
assert.equal(byokToCloud.activeMode, "useclevr_cloud", "BYOK -> Cloud save moves the Active badge to UseClevr Cloud")
assert.equal(byokToCloud.feedback?.title, "AI mode changed to UseClevr Cloud", "Cloud success title is mode-specific")
assert.equal(byokToCloud.feedback?.message, "UseClevr Cloud is now your active AI provider.", "Cloud success message is exact")

// 3. Automatic successful save.
const automaticSave = resolveAiModeSaveState({
  activeMode: "byok",
  selectedMode: "automatic",
  outcome: saved("automatic"),
})
assert.equal(automaticSave.activeMode, "automatic", "Automatic save moves the Active badge to Automatic")
assert.equal(automaticSave.feedback?.title, "AI mode changed to Automatic", "Automatic success title is exact")
assert.equal(automaticSave.feedback?.message, "Automatic AI routing is now active.", "Automatic success message is exact")

// 4. Local AI successful save.
const localSave = resolveAiModeSaveState({
  activeMode: "useclevr_cloud",
  selectedMode: "local",
  outcome: saved("local"),
})
assert.equal(localSave.activeMode, "local", "Local save moves the Active badge to Local AI")
assert.equal(localSave.feedback?.title, "AI mode changed to Local AI", "Local success title is exact")
assert.equal(localSave.feedback?.message, "Local AI routing is now active.", "Local success message is exact")

// 5. Failed save keeps the previous Active badge and restores the selection.
const failedSave = resolveAiModeSaveState({
  activeMode: "useclevr_cloud",
  selectedMode: "byok",
  outcome: failed("AI mode switching requires Hybrid AI Lite or MEGA."),
})
assert.equal(failedSave.activeMode, "useclevr_cloud", "failed save keeps the Active badge on the previously saved mode")
assert.equal(failedSave.selectedMode, "useclevr_cloud", "failed save restores the selection to the active mode")
assert.equal(failedSave.feedback, null, "failed save shows no success feedback")

// 6. Reload restores the persisted mode into both states with no feedback.
const reloaded = initialAiModeUiState("byok")
assert.deepEqual(reloaded, { activeMode: "byok", selectedMode: "byok", feedback: null }, "reload restores the persisted Active mode")
assert.equal(initialAiModeUiState("cloud-only").activeMode, "useclevr_cloud", "reload maps legacy cloud-only to UseClevr Cloud")
assert.equal(initialAiModeUiState("local-only").activeMode, "local", "reload maps legacy local-only to Local AI")
assert.equal(initialAiModeUiState("auto").activeMode, "automatic", "reload maps legacy auto to Automatic")

// 7. BYOK success feedback only receives provider name and model, never key fields.
const keyProvider = { providerName: "OpenAI", modelName: "gpt-4o-mini", apiKey: "sk-secret-value-123", apiKeyPreview: "•••• abcd" }
const keyFeedback = getAiModeSuccessFeedback("byok", keyProvider)
assert.equal(keyFeedback.message, "OpenAI · gpt-4o-mini is now your active provider.", "BYOK feedback keeps provider and model only")
assert.equal(keyFeedback.message.includes("sk-secret-value-123"), false, "BYOK feedback never contains the API key")
assert.equal(keyFeedback.message.includes("abcd"), false, "BYOK feedback never contains the key preview")
assert.equal(getAiModeSuccessFeedback("byok", null).message, "Your enabled AI provider is now active.", "BYOK feedback stays truthful when no provider detail is passed")

// 8. Duplicate submission guard is a client behavior; assert the handler wiring.
const clientSource = readProjectFile("src/app/(auth)/app/settings/ai-providers/ai-providers-client.tsx")

assertIncludes(clientSource, "if (isSavingMode) return;", "mode save handler blocks duplicate submissions while a request is pending")
assertIncludes(clientSource, "disabled={isSavingMode}", "Save AI mode button is disabled while saving")
assertIncludes(clientSource, '{isSavingMode ? "Saving..." : pageState.modeSaveLabel}', "Save AI mode button shows Saving... while pending and restores the label")
assertIncludes(clientSource, "formData.set(\"aiMode\", selectedMode)", "mode save submits the currently selected mode")
assertIncludes(clientSource, "const [activeMode, setActiveMode] = React.useState<PublicAiMode>(modeUi.activeMode)", "activeMode state starts from the server-persisted mode")
assertIncludes(clientSource, "const [selectedMode, setSelectedMode] = React.useState<PublicAiMode>(modeUi.selectedMode)", "selectedMode state starts from the server-persisted mode")
assertIncludes(clientSource, "active={activeMode === \"automatic\"}", "Automatic option renders its Active badge from saved state")
assertIncludes(clientSource, "active={activeMode === \"local\"}", "Local AI option renders its Active badge from saved state")
assertIncludes(clientSource, "active={activeMode === \"byok\"}", "BYOK option renders its Active badge from saved state")
assertIncludes(clientSource, "active={activeMode === \"useclevr_cloud\"}", "UseClevr Cloud option renders its Active badge from saved state")
assertIncludes(clientSource, "checked={selected === value}", "mode radios are controlled by selectedMode, independent from the Active badge")
assertIncludes(clientSource, "setSelectedMode(activeMode)", "failed save restores the selection to the still-active mode")
assertIncludes(clientSource, "outcome: { success: true, savedMode: result.data.savedAiMode || selectedMode }", "success uses the server-confirmed saved mode")
assertIncludes(clientSource, "resolveByokActiveProvider(providers)", "BYOK success resolves provider details from the saved provider list")
assertNotIncludes(clientSource, "function modeNoticeMessage", "legacy generic mode notice is removed")
assertIncludes(clientSource, "router.refresh()", "successful save refreshes server-rendered state")

// 9. Server action returns the server-confirmed mode.
const actionSource = readProjectFile("src/app/actions/settings.ts")
assertIncludes(actionSource, "const savedAiMode = toPublicAiMode(mode)", "updateAiMode derives the persisted mode after save")
assertIncludes(actionSource, "return success({ message: \"AI mode saved.\", savedAiMode })", "updateAiMode returns the persisted mode to the client")
assertIncludes(actionSource, "title: \"AI mode saved\"", "successful mode change still records the existing AI mode activity event")

// 10. resolveByokActiveProvider prefers the enabled default provider.
const providerList = [
  { providerName: "Secondary", modelName: "m-2", enabled: true, isDefault: false, providerType: "openai" },
  { providerName: "Primary", modelName: "m-1", enabled: true, isDefault: true, providerType: "openai" },
  { providerName: "Disabled", modelName: "m-3", enabled: false, isDefault: true, providerType: "openai" },
  { providerName: "Local", modelName: "llama", enabled: true, isDefault: false, providerType: "ollama" },
]
assert.equal(resolveByokActiveProvider(providerList)?.providerName, "Primary", "BYOK feedback uses the enabled default provider")
assert.equal(resolveByokActiveProvider([providerList[0]!, providerList[3]!])?.providerName, "Secondary", "BYOK feedback falls back to the first enabled BYOK provider")
assert.equal(resolveByokActiveProvider([providerList[2]!, providerList[3]!]), null, "BYOK feedback skips disabled and local providers")

console.log("AI mode save feedback tests passed.")
