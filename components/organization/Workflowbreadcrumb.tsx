"use client"

import { X, ChevronRight as Sep } from "lucide-react"
import { useWorkflow, WORKFLOWS, type WorkflowId } from "./Workflowcontext"

export function WorkflowBreadcrumb({
  currentPrimary,
  currentSub,
  onNavigate,
}: {
  currentPrimary: "rosters" | "events" | "broadcast"
  currentSub: string
  onNavigate: (primary: "rosters" | "events" | "broadcast", sub: string) => void
}) {
  const { workflow, clearWorkflow } = useWorkflow()
  if (!workflow) return null

  const def = WORKFLOWS[workflow]
  const activeIndex = def.steps.findIndex((s) => s.primary === currentPrimary && s.sub === currentSub)

  return (
    <div className="flex items-center gap-2 flex-wrap bg-black/40 border border-gold/15 rounded-lg px-4 py-2.5 mb-6">
      <span className="text-[10px] uppercase tracking-widest font-cinzel text-gold/60 shrink-0">{def.name}</span>
      <Sep className="h-3 w-3 text-gray-600 shrink-0" />
      <div className="flex items-center gap-1.5 flex-wrap">
        {def.steps.map((step, i) => {
          const isActive = i === activeIndex
          const isDone = activeIndex >= 0 && i < activeIndex
          return (
            <button
              key={step.label}
              onClick={() => onNavigate(step.primary, step.sub)}
              className={`flex items-center gap-1 text-xs font-cinzel px-2 py-1 rounded-md transition-colors ${
                isActive
                  ? "bg-gold text-black font-bold"
                  : isDone
                  ? "text-gold/70 hover:text-gold"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {i + 1}. {step.label}
            </button>
          )
        })}
      </div>
      <button
        onClick={clearWorkflow}
        title="Exit this workflow"
        className="ml-auto text-gray-600 hover:text-gray-300 shrink-0 p-0.5"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}