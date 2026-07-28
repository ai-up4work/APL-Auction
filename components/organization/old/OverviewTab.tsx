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
        "Generate overlays for broadcast"
      ],
      icon: Trophy,
      accent: "from-gold via-yellow-500 to-amber-600",
      borderColor: "border-gold/50",
      hoverBorder: "hover:border-gold",
      tags: ["Tournament", "Auction", "Professional"]
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
        "Generate overlays for broadcast"
      ],
      icon: Users,
      accent: "from-silver via-slate-400 to-gray-500",
      borderColor: "border-slate-400/50",
      hoverBorder: "hover:border-slate-400",
      tags: ["Tournament", "Manual", "Flexible"]
    },
    {
      id: "standalone",
      name: "Quick Standalone Matches",
      description: "Skip tournament structure and create standalone matches directly",
      steps: [
        "Add teams (manual or from auction)",
        "Create match directly",
        "Assign players to squad",
        "Generate overlay for broadcast"
      ],
      icon: PlayCircle,
      accent: "from-blue-500 via-cyan-500 to-teal-500",
      borderColor: "border-blue-400/50",
      hoverBorder: "hover:border-blue-400",
      tags: ["Quick Start", "Standalone", "Simple"]
    }
  ]

  return (
    <div className="space-y-8">
      {/* Organization Header */}
      {org && (
        <div className="bg-gradient-to-r from-gold/10 via-transparent to-transparent border border-gold/20 rounded-xl p-8 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-gold/70 font-cinzel mb-2">Organization</p>
              <p className="text-2xl font-cinzel font-bold text-white">{org.name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500 font-cinzel mb-2">Organization Code</p>
              <p className="text-lg font-mono text-gray-300">{org.slug}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500 font-cinzel mb-2">Plan Type</p>
              <p className="text-lg text-gray-300 capitalize">{org.plan}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-12">
        <h2 className="text-3xl font-cinzel font-bold text-white mb-3">Choose Your Workflow</h2>
        <p className="text-gray-400 text-lg">Select how you want to organize and manage your matches</p>
      </div>

      {/* Workflow Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {workflows.map((workflow) => {
          const Icon = workflow.icon
          return (
            <div
              key={workflow.id}
              className={`group relative bg-black/40 backdrop-blur-sm rounded-xl border-2 ${workflow.borderColor} transition-all duration-300 ${workflow.hoverBorder} overflow-hidden`}
            >
              {/* Gradient accent line */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${workflow.accent}`} />

              {/* Content */}
              <div className="p-8">
                {/* Icon & Title */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`bg-gradient-to-br ${workflow.accent} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-cinzel font-bold text-white mb-1">
                      {workflow.name}
                    </h3>
                    <p className="text-sm text-gray-400">{workflow.description}</p>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {workflow.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] uppercase tracking-widest font-cinzel px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Steps */}
                <div className="space-y-3 mb-8 bg-white/[0.02] rounded-lg p-5 border border-white/5">
                  <p className="text-xs uppercase tracking-widest text-gray-500 font-cinzel mb-3">Workflow Steps</p>
                  {workflow.steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3 group">
                      <div className={`bg-gradient-to-br ${workflow.accent} w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg`}>
                        <span className="text-xs font-bold text-white">{idx + 1}</span>
                      </div>
                      <span className="text-sm text-gray-300 group-hover:text-white transition-colors pt-1">{step}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => onSelectPath(workflow.id as "auction" | "manual" | "standalone")}
                  className={`w-full py-3 px-4 rounded-lg font-cinzel font-bold uppercase text-sm tracking-wide flex items-center justify-center gap-2 transition-all duration-300 ${
                    workflow.id === "auction"
                      ? "bg-gradient-to-r from-gold via-yellow-500 to-amber-600 text-black hover:shadow-lg hover:shadow-gold/40"
                      : workflow.id === "manual"
                      ? "bg-gradient-to-r from-slate-400 via-slate-500 to-slate-600 text-white hover:shadow-lg hover:shadow-slate-400/40"
                      : "bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 text-white hover:shadow-lg hover:shadow-blue-500/40"
                  }`}
                >
                  Start Here <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Reference */}
      <div className="mt-12 bg-gradient-to-r from-gold/10 via-transparent to-blue-500/10 rounded-xl border border-gold/20 p-8">
        <div className="flex items-start gap-4">
          <Zap className="w-6 h-6 text-gold flex-shrink-0 mt-1" />
          <div>
            <h4 className="text-lg font-cinzel font-bold text-white mb-3">Quick Tips</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-gold mt-1">•</span>
                <span><strong>Player Bank:</strong> Add all your manual players first for reusability across matches</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold mt-1">•</span>
                <span><strong>Team Pool:</strong> Create your teams once and use them across multiple tournaments and matches</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold mt-1">•</span>
                <span><strong>Flexibility:</strong> Switch between workflows anytime - they all work independently</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold mt-1">•</span>
                <span><strong>Overlays:</strong> Each match generates overlay data for broadcast integration</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
