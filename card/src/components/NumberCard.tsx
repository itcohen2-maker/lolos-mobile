import React from "react";

interface NumberCardProps {
  number: number;
  isSelected: boolean;
  onClick: (n: number) => void;
}

function getColors(value: number) {
  if (value <= 9)
    return { border: "border-blue-400", text: "text-blue-600", bg: "bg-white" };
  if (value <= 19)
    return { border: "border-green-400", text: "text-green-600", bg: "bg-white" };
  return { border: "border-red-400", text: "text-red-600", bg: "bg-white" };
}

export default function NumberCard({ number, isSelected, onClick }: NumberCardProps) {
  const c = getColors(number);

  return (
    <div
      onClick={() => onClick(number)}
      className={[
        "relative w-[90px] h-[120px] rounded-2xl border-2",
        "flex flex-col items-center justify-center cursor-pointer",
        "transition-all duration-200 shadow-md",
        c.bg,
        isSelected
          ? "border-yellow-400 shadow-lg shadow-yellow-400/30 -translate-y-2 scale-105"
          : `${c.border} hover:shadow-lg hover:-translate-y-1`,
      ].join(" ")}
      style={{ fontFamily: "'Fredoka', sans-serif" }}
    >
      <span className={`text-3xl font-bold ${c.text}`}>{number}</span>
      <span className="text-[10px] text-gray-400 mt-1 tracking-wide">
        מספר
      </span>
    </div>
  );
}
