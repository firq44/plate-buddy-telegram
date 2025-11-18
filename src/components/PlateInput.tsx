import { cn } from '@/lib/utils';

interface PlateInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const PlateInput = ({ value, onChange, placeholder, className }: PlateInputProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase().replace(/\s+/g, ' ');
    onChange(newValue);
  };

  return (
    <div className={cn("flex items-stretch bg-white rounded-lg overflow-hidden", className)}>
      {/* PL Badge */}
      <div className="bg-[#4169E1] text-white px-4 flex flex-col items-center justify-center gap-0.5">
        <span className="text-lg">🇵🇱</span>
        <span className="text-sm font-bold leading-none">PL</span>
      </div>
      
      {/* Plate Number Input */}
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder || "SS 4657C"}
        className="flex-1 px-4 py-3 text-xl font-semibold tracking-wide text-gray-600 bg-white focus:outline-none placeholder:text-gray-300 uppercase"
        maxLength={15}
      />
    </div>
  );
};
