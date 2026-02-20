import React from "react";

interface FractionCardProps {
  numerator: number;
  denominator: number;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: (denominator: number) => void;
}

export default function FractionCard({
  numerator,
  denominator,
  isSelected,
  isDisabled,
  onClick,
}: FractionCardProps) {
  return (
    <div
      onClick={() => !isDisabled && onClick(denominator)}
      className={[
        "relative w-[90px] h-[120px] rounded-2xl border-2",
        "flex flex-col items-center justify-center",
        "transition-all duration-200 shadow-md",
        // Purple-to-indigo gradient background
        "bg-gradient-to-b from-purple-500 to-indigo-600",
        // Disabled = dimmed with not-allowed cursor, enabled = pointer
        isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
        // Selection / hover states
        isSelected
          ? "border-yellow-400 shadow-lg shadow-yellow-400/30 -translate-y-2 scale-105"
          : isDisabled
            ? "border-purple-300/50"
            : "border-purple-400/50 hover:border-purple-300 hover:shadow-lg hover:-translate-y-1",
      ].join(" ")}
      style={{ fontFamily: "'Fredoka', sans-serif" }}
    >
      {/* Lock icon for disabled state */}
      {isDisabled && (
        <div className="absolute top-2 right-2">
          <svg
            className="w-4 h-4 text-white/60"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}

      {/* Fraction display */}
      <span className="text-2xl font-bold text-white leading-tight">
        {numerator}
      </span>
      <div className="w-10 h-0.5 bg-white/60 my-1 rounded-full" />
      <span className="text-2xl font-bold text-white leading-tight">
        {denominator}
      </span>
      <span className="text-[10px] text-white/70 mt-1 tracking-wide">
        שבר
      </span>
    </div>
  );
}
