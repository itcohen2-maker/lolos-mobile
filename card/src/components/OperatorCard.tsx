import React from "react";

interface OperatorCardProps {
  operator: string;
  isSelected: boolean;
  onClick: (op: string) => void;
}

export default function OperatorCard({ operator, isSelected, onClick }: OperatorCardProps) {
  return (
    <div
      onClick={() => onClick(operator)}
      className={[
        "relative w-[90px] h-[120px] rounded-2xl border-2",
        "flex flex-col items-center justify-center cursor-pointer",
        "transition-all duration-200 shadow-md",
        "bg-orange-50",
        isSelected
          ? "border-yellow-400 shadow-lg shadow-yellow-400/30 -translate-y-2 scale-105"
          : "border-orange-400 hover:shadow-lg hover:-translate-y-1",
      ].join(" ")}
      style={{ fontFamily: "'Fredoka', sans-serif" }}
    >
      <span className="text-4xl font-bold text-orange-600">{operator}</span>
      <span className="text-[10px] text-orange-400 mt-1 tracking-wide">
        פעולה
      </span>
    </div>
  );
}
