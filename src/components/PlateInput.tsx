import { useState } from 'react';
import { cn } from '@/lib/utils';

interface PlateInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const PlateInput = ({ value, onChange, placeholder, className }: PlateInputProps) => {
  const [focused, setFocused] = useState(false);
  
  const formatPlateNumber = (val: string) => {
    // Remove all spaces and convert to uppercase
    const cleaned = val.replace(/\s/g, '').toUpperCase();
    
    // Extract parts: letters, numbers, optional letter
    const match = cleaned.match(/^([A-Z]{0,3})(\d{0,5})([A-Z]?)$/);
    
    if (!match) return val.toUpperCase();
    
    const [, letters, numbers, lastLetter] = match;
    
    // Format: XX XXXXC or XXX XXXXC
    let formatted = letters;
    if (numbers) {
      formatted += (letters ? ' ' : '') + numbers;
    }
    if (lastLetter) {
      formatted += lastLetter;
    }
    
    return formatted;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const formatted = formatPlateNumber(newValue);
    onChange(formatted);
  };

  const displayValue = value || '';

  return (
    <div className={cn("flex items-center gap-0 bg-white rounded-lg overflow-hidden shadow-sm", className)}>
      {/* PL Badge */}
      <div className="bg-[#0F47AF] text-white px-3 py-4 flex flex-col items-center justify-center min-w-[60px]">
        <span className="text-xs font-bold">🇵🇱</span>
        <span className="text-sm font-bold mt-1">PL</span>
      </div>
      
      {/* Plate Number Input */}
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder || "SS 4657C"}
        className={cn(
          "flex-1 px-4 py-4 text-2xl font-bold tracking-wider text-gray-700 bg-white",
          "focus:outline-none placeholder:text-gray-300 uppercase",
          "border-2 border-l-0 rounded-r-lg",
          focused ? "border-primary" : "border-gray-300"
        )}
        maxLength={12}
      />
    </div>
  );
};
