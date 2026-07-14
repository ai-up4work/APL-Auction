export default function SectionDivider() {
  return (
    <div className="w-full py-3 relative">
      <div className="absolute inset-0 bg-black/90 z-0"></div>
      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Top line - increased to 100rem */}
        <div className="w-full h-[2px] bg-wardens-gold opacity-80 mb-4" style={{ maxWidth: "100rem" }}></div>

        {/* Shield icon */}
        <div className="flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-14 h-14 text-wardens-gold"
          >
            <path
              d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"
              stroke="currentColor"
              fill="rgba(245, 166, 35, 0.15)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Bottom line - increased to 100rem */}
        <div className="w-full h-[2px] bg-wardens-gold opacity-80 mt-4" style={{ maxWidth: "100rem" }}></div>
      </div>
    </div>
  )
}
