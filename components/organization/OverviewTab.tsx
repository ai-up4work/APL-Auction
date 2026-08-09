"use client"

import { Trophy, Swords, PlayCircle, ArrowRight, Users, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { OrgSummary } from "@/lib/organization/organization"

interface OverviewTabProps {
  org?: OrgSummary
  onSelectPath: (path: "auction" | "manual" | "standalone") => void
}

export function OverviewTab({ org, onSelectPath }: OverviewTabProps) {
  const workflows = [
    {
      id: "auction",
      name: "Full Auction Tournament",
      description: "Complete tournament flow with auction-based team assignments",
      steps: [
        "Create tournament bracket",
        "Add auction for team selection",
        "Create matches from bracket",
        "Generate overlays for broadcast",
      ],
      icon: Trophy,
      accent: "text-gold",
      borderAccent: "border-l-gold",
      tags: ["Tournament", "Auction", "Professional"],
    },
    {
      id: "manual",
      name: "Manual Team Tournament",
      description: "Tournament with manually assigned teams and players from your pool",
      steps: [
        "Add teams to team pool",
        "Add players to player bank",
        "Create tournament bracket",
        "Create matches and assign players",
        "Generate overlays for broadcast",
      ],
      icon: Users,
      accent: "text-slate-300",
      borderAccent: "border-l-slate-400",
      tags: ["Tournament", "Manual", "Flexible"],
    },
    {
      id: "standalone",
      name: "Quick Standalone Matches",
      description: "Skip tournament structure and create standalone matches directly",
      steps: [
        "Add teams (manual or from auction)",
        "Create match directly",
        "Assign players to squad",
        "Generate overlay for broadcast",
      ],
      icon: PlayCircle,
      accent: "text-cyan-300",
      borderAccent: "border-l-cyan-400",
      tags: ["Quick Start", "Standalone", "Simple"],
    },
  ]

  return (
    <div className="space-y-10">
      {/* Organization Header */}
      {org && (
        <div className="border border-gold/15 rounded-lg p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gold/60 font-cinzel mb-1.5">Organization</p>
              <p className="text-xl font-cinzel font-bold text-white">{org.name}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 font-cinzel mb-1.5">Organization Code</p>
              <p className="text-base font-mono text-gray-300">{org.slug}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 font-cinzel mb-1.5">Plan Type</p>
              <p className="text-base text-gray-300 capitalize">{org.plan}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-cinzel font-bold text-white mb-2">Choose Your Workflow</h2>
        <p className="text-gray-400">Select how you want to organize and manage your matches</p>
      </div>

      {/* Workflow Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {workflows.map((workflow) => {
          const Icon = workflow.icon
          return (
            <div
              key={workflow.id}
              className={`bg-black/40 rounded-lg border border-gold/10 border-l-2 ${workflow.borderAccent} hover:border-gold/30 transition-colors duration-200 p-6 flex flex-col`}
            >
              {/* Icon & Title */}
              <div className="flex items-start gap-3 mb-3">
                <Icon className={`w-5 h-5 ${workflow.accent} shrink-0 mt-0.5`} />
                <div>
                  <h3 className="text-base font-cinzel font-bold text-white leading-tight">{workflow.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{workflow.description}</p>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-5">
                {workflow.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded border border-white/10 text-gray-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Steps */}
              <div className="space-y-2.5 mb-6 flex-1">
                <p className="text-[10px] uppercase tracking-widest text-gray-600 font-cinzel mb-2">Workflow Steps</p>
                {workflow.steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <span className={`text-xs font-mono ${workflow.accent} shrink-0 w-4`}>{idx + 1}.</span>
                    <span className="text-xs text-gray-400 leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <button
                onClick={() => onSelectPath(workflow.id as "auction" | "manual" | "standalone")}
                className="w-full py-2.5 px-4 rounded-md font-cinzel font-bold uppercase text-xs tracking-wide flex items-center justify-center gap-2 border border-gold/30 text-gold hover:bg-gold/10 hover:border-gold/50 transition-colors"
              >
                Start Here <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Quick Reference */}
      <div className="border border-gold/15 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Zap className="w-4 h-4 text-gold shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-cinzel font-bold text-white mb-3">Quick Tips</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>
                <strong className="text-gray-300">Player Bank:</strong> Add all your manual players first for
                reusability across matches
              </li>
              <li>
                <strong className="text-gray-300">Team Pool:</strong> Create your teams once and use them across
                multiple tournaments and matches
              </li>
              <li>
                <strong className="text-gray-300">Flexibility:</strong> Switch between workflows anytime — they all
                work independently
              </li>
              <li>
                <strong className="text-gray-300">Overlays:</strong> Each match generates overlay data for broadcast
                integration
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}