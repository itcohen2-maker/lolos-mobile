import React from "react";

interface JokerCardProps {
  isSelected?: boolean;
  onClick?: () => void;
}

export default function JokerCard({ isSelected, onClick }: JokerCardProps) {
  return (
    <div
      onClick={onClick}
      className={[
        "relative w-[90px] h-[120px] rounded-2xl border-2",
        "flex flex-col items-center justify-center",
        "transition-all duration-200 shadow-md",
        "bg-yellow-50",
        onClick ? "cursor-pointer" : "",
        isSelected
          ? "border-yellow-400 shadow-lg shadow-yellow-400/30 -translate-y-2 scale-105"
          : "border-yellow-500 hover:shadow-lg hover:-translate-y-1",
      ].join(" ")}
      style={{ fontFamily: "'Fredoka', sans-serif" }}
    >
      <span className="text-3xl">★</span>
      <span className="text-sm font-bold text-yellow-600 mt-1">ג׳וקר</span>
    </div>
  );
}
