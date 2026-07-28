"use client"

import { createContext, useContext, useState, useCallback } from "react"

export type WorkflowId = "auction" | "manual" | "standalone"

export interface WorkflowStep {
  label: string
  /** which primary tab + sub-tab this step lives on, so the breadcrumb can link straight there */
  primary: "rosters" | "events" | "broadcast"
  sub: string
}

export const WORKFLOWS: Record<WorkflowId, { name: string; steps: WorkflowStep[] }> = {
  auction: {
    name: "Full Auction Tournament",
    steps: [
      { label: "Create bracket", primary: "events", sub: "tournaments" },
      { label: "Run auction", primary: "events", sub: "auctions" },
      { label: "Create matches", primary: "events", sub: "matches" },
      { label: "Set up overlays", primary: "broadcast", sub: "overlays" },
    ],
  },
  manual: {
    name: "Manual Team Tournament",
    steps: [
      { label: "Add teams", primary: "rosters", sub: "teamPool" },
      { label: "Add players", primary: "rosters", sub: "playerBank" },
      { label: "Create bracket", primary: "events", sub: "tournaments" },
      { label: "Create matches", primary: "events", sub: "matches" },
      { label: "Set up overlays", primary: "broadcast", sub: "overlays" },
    ],
  },
  standalone: {
    name: "Quick Standalone Matches",
    steps: [
      { label: "Build a squad", primary: "rosters", sub: "squadBoard" },
      { label: "Create match", primary: "events", sub: "matches" },
      { label: "Set up overlay", primary: "broadcast", sub: "overlays" },
    ],
  },
}

interface WorkflowContextValue {
  workflow: WorkflowId | null
  setWorkflow: (w: WorkflowId | null) => void
  clearWorkflow: () => void
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null)

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [workflow, setWorkflowState] = useState<WorkflowId | null>(null)

  const setWorkflow = useCallback((w: WorkflowId | null) => setWorkflowState(w), [])
  const clearWorkflow = useCallback(() => setWorkflowState(null), [])

  return (
    <WorkflowContext.Provider value={{ workflow, setWorkflow, clearWorkflow }}>{children}</WorkflowContext.Provider>
  )
}

export function useWorkflow() {
  const ctx = useContext(WorkflowContext)
  if (!ctx) throw new Error("useWorkflow must be used within a WorkflowProvider")
  return ctx
}