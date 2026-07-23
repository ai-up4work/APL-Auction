export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 border-4 border-wardens-gold/20 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-transparent border-t-wardens-gold rounded-full animate-spin"></div>
      </div>
    </div>
  )
}
