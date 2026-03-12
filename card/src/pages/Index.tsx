import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import NumberCard from "@/components/NumberCard";
import OperatorCard from "@/components/OperatorCard";
import JokerCard from "@/components/JokerCard";
import FractionCard from "@/components/FractionCard";
import "@fontsource/fredoka/400.css";
import "@fontsource/fredoka/700.css";

const numbers = Array.from({ length: 26 }, (_, i) => i);
const operators = ["+", "-", "×", "÷"];
const fractions = [2, 3, 4, 5]; // denominators for 1/2, 1/3, 1/4, 1/5

const Index = () => {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [targetValue, setTargetValue] = useState(24);
  const [selectedFraction, setSelectedFraction] = useState<number | null>(null);

  const handleFractionClick = (denominator: number) => {
    // Only allow if target is evenly divisible
    if (targetValue % denominator !== 0) return;
    setSelectedFraction(denominator);
    // Math action: immediately update target
    setTargetValue((prev) => prev / denominator);
  };

  return (
    <div className="min-h-screen bg-background px-6 py-16 md:px-12 lg:px-20">
      <div className="mx-auto max-w-5xl">
        {/* ─── Number Cards ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h1
            className="text-4xl md:text-6xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "'Fredoka', sans-serif" }}
          >
            Number Cards
          </h1>
          <p className="mt-3 text-muted-foreground text-lg">
            {selectedNumber !== null
              ? `Selected: ${selectedNumber}`
              : "Tap a card to select it"}
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-4 md:gap-5">
          {numbers.map((n, i) => (
            <motion.div
              key={n}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
            >
              <NumberCard
                number={n}
                isSelected={selectedNumber === n}
                onClick={setSelectedNumber}
              />
            </motion.div>
          ))}
        </div>

        {/* ─── Operator Cards ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 mb-8 text-center"
        >
          <h2
            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "'Fredoka', sans-serif" }}
          >
            Operator Cards
          </h2>
          <p className="mt-3 text-muted-foreground text-lg">
            {selectedOperator
              ? `Selected: ${selectedOperator}`
              : "Tap an operator"}
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-4 md:gap-5">
          {operators.map((op, i) => (
            <motion.div
              key={op}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
            >
              <OperatorCard
                operator={op}
                isSelected={selectedOperator === op}
                onClick={setSelectedOperator}
              />
            </motion.div>
          ))}
        </div>

        {/* ─── Fraction Cards ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-16 mb-8 text-center"
        >
          <h2
            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "'Fredoka', sans-serif" }}
          >
            Fraction Cards
          </h2>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-muted-foreground text-lg">Target:</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={targetValue}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-3xl md:text-4xl font-bold text-indigo-600"
                style={{ fontFamily: "'Fredoka', sans-serif" }}
              >
                {targetValue}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-4 md:gap-5">
          {fractions.map((d, i) => {
            const disabled = targetValue % d !== 0;
            return (
              <motion.div
                key={d}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
              >
                <FractionCard
                  numerator={1}
                  denominator={d}
                  isSelected={selectedFraction === d}
                  isDisabled={disabled}
                  onClick={handleFractionClick}
                />
              </motion.div>
            );
          })}
        </div>

        {/* ─── Joker Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 mb-8 text-center"
        >
          <h2
            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "'Fredoka', sans-serif" }}
          >
            Special Card
          </h2>
          <p className="mt-3 text-muted-foreground text-lg">
            The rare Joker card
          </p>
        </motion.div>

        <div className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: -3 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, delay: 1.0, type: "spring" }}
          >
            <JokerCard />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Index;
