"use client"

import { LucideIcon } from "lucide-react"

interface WorkflowInfoCardProps {
  icon: LucideIcon
  title: string
  description: string
  actionText?: string
  onAction?: () => void
  variant?: "gold" | "slate" | "blue"
}

export function WorkflowInfoCard({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  variant = "gold",
}: WorkflowInfoCardProps) {
  const variants = {
    gold: {
      gradient: "from-gold/20 to-transparent",
      border: "border-gold/30",
      icon: "bg-gold/20",
      text: "text-gold",
    },
    slate: {
      gradient: "from-slate-400/20 to-transparent",
      border: "border-slate-400/30",
      icon: "bg-slate-400/20",
      text: "text-slate-300",
    },
    blue: {
      gradient: "from-blue-500/20 to-transparent",
      border: "border-blue-500/30",
      icon: "bg-blue-500/20",
      text: "text-blue-300",
    },
  }

  const style = variants[variant]

  return (
    <div className={`bg-gradient-to-r ${style.gradient} border ${style.border} rounded-lg p-4 backdrop-blur-sm`}>
      <div className="flex items-start gap-3">
        <div className={`${style.icon} p-2 rounded-lg flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${style.text}`} />
        </div>
        <div className="flex-1">
          <h4 className="font-cinzel font-bold text-white mb-1">{title}</h4>
          <p className="text-sm text-gray-400">{description}</p>
          {actionText && onAction && (
            <button
              onClick={onAction}
              className={`mt-3 text-sm font-semibold ${style.text} hover:underline transition-colors`}
            >
              {actionText} →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
