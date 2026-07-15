import Image from "next/image"
import Link from "next/link"
import { showcaseSlides, slugify, type ShowcaseSlide } from "@/data/site-data"

interface RelatedTournamentsProps {
  currentSlug: string
  currentTag: string
}

export default function RelatedTournaments({ currentSlug, currentTag }: RelatedTournamentsProps) {
  const related: ShowcaseSlide[] = showcaseSlides
    .filter((t) => slugify(t.title) !== currentSlug)
    .sort((a, b) => (a.tag === currentTag ? -1 : 0) - (b.tag === currentTag ? -1 : 0))
    .slice(0, 3)

  if (related.length === 0) return null

  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
      <h3 className="text-xl font-bold text-white mb-4 font-cinzel">Related Tournaments</h3>
      <div className="space-y-4">
        {related.map((t) => (
          <Link
            key={t.title}
            href={`/tournament/${slugify(t.title)}`}
            className="flex items-center gap-3 group"
          >
            <div className="relative h-14 w-14 shrink-0 rounded-md overflow-hidden border border-gold/20">
              <Image src={t.image || "/placeholder.svg"} alt={t.title} fill className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate group-hover:text-gold transition-colors">
                {t.title}
              </p>
              <p className="text-gray-400 text-xs truncate">{t.tag}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}