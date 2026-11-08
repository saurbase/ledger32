import { create } from "zustand"

/**
 * UI-only state that doesn't belong to the server data layer:
 *  - command palette open/closed
 *  - shortcuts help overlay open/closed
 *  - pending actions delivered to a view after navigation (e.g. pressing
 *    Ctrl+N on the dashboard navigates to Journal then opens the New Entry
 *    dialog — the "new-entry" pending action is consumed by JournalView).
 */
interface UiState {
  paletteOpen: boolean
  helpOpen: boolean
  pendingAction: string | null
  setPaletteOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  /** Set a pending action; the target view consumes it on mount/update. */
  requestAction: (action: string) => void
  /** Clear the pending action after the target view has handled it. */
  consumeAction: () => void
}

export const useUiStore = create<UiState>((set) => ({
  paletteOpen: false,
  helpOpen: false,
  pendingAction: null,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  requestAction: (pendingAction) => set({ pendingAction }),
  consumeAction: () => set({ pendingAction: null }),
}))
