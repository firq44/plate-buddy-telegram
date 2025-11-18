import { cn } from '@/lib/utils';
import { useRef, useEffect } from 'react';

interface PlateInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const PlateInput = ({ value, onChange, placeholder, className }: PlateInputProps) => {
  const lettersRef = useRef<HTMLInputElement>(null);
  const numbersRef = useRef<HTMLInputElement>(null);

  // Split value into letters and numbers parts
  const parts = value.trim().split(' ');
  const letters = parts[0] || '';
  const numbers = parts.slice(1).join('') || '';

  const handleLettersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
    if (newValue.length <= 3) {
      onChange(newValue + (numbers ? ' ' + numbers : ''));
      if (newValue.length === 2 && numbersRef.current) {
        numbersRef.current.focus();
      }
    }
  };

  const handleNumbersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (newValue.length <= 5) {
      onChange((letters || '') + (newValue ? ' ' + newValue : ''));
    }
  };

  const handleLettersKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' && letters.length > 0 && numbersRef.current) {
      e.preventDefault();
      numbersRef.current.focus();
    }
  };

  const handleNumbersKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && numbers.length === 0 && lettersRef.current) {
      e.preventDefault();
      lettersRef.current.focus();
    }
  };

  return (
    <div className={cn("flex items-stretch bg-white rounded-lg overflow-hidden shadow-lg border-2 border-black", className)}>
      {/* PL Badge */}
      <div className="bg-[#4169E1] text-white px-4 flex flex-col items-center justify-center gap-0.5">
        <span className="text-lg">🇵🇱</span>
        <span className="text-sm font-bold leading-none">PL</span>
      </div>
      
      {/* Letters Input (SS) */}
      <input
        ref={lettersRef}
        type="text"
        value={letters}
        onChange={handleLettersChange}
        onKeyDown={handleLettersKeyDown}
        placeholder="SS"
        className="w-20 px-3 py-3 text-2xl font-bold tracking-widest text-[#8B9DC3] bg-[#E8EDF2] focus:outline-none placeholder:text-[#B8C5D6] uppercase text-center"
        maxLength={3}
      />

      {/* Separator */}
      <div className="w-0.5 bg-gray-400 self-stretch" />
      
      {/* Numbers Input (4657C) */}
      <input
        ref={numbersRef}
        type="text"
        value={numbers}
        onChange={handleNumbersChange}
        onKeyDown={handleNumbersKeyDown}
        placeholder="4657C"
        className="flex-1 px-4 py-3 text-2xl font-bold tracking-widest text-[#8B9DC3] bg-[#E8EDF2] focus:outline-none placeholder:text-[#B8C5D6] uppercase"
        maxLength={5}
      />
    </div>
  );
};
