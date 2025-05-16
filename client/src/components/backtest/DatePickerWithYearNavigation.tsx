import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import React from "react";

interface DatePickerWithYearNavigationProps {
  selected?: Date;
  onSelect: (date: Date | undefined) => void;
}

export function DatePickerWithYearNavigation({
  selected,
  onSelect,
}: DatePickerWithYearNavigationProps) {
  const [currentDate, setCurrentDate] = React.useState<Date>(selected || new Date());

  // When the selected date changes externally, update our internal state
  React.useEffect(() => {
    if (selected) {
      setCurrentDate(selected);
    }
  }, [selected]);

  const handleYearChange = (increment: number) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(newDate.getFullYear() + increment);
    setCurrentDate(newDate);
    onSelect(newDate);
  };

  const handleSelectYear = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const year = parseInt(event.target.value);
    const newDate = new Date(currentDate);
    newDate.setFullYear(year);
    setCurrentDate(newDate);
    onSelect(newDate);
  };

  // Generate year options (15 years in the past, 15 years in the future)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 31 }, (_, i) => currentYear - 15 + i);

  return (
    <div className="p-3">
      <div className="flex justify-between items-center mb-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleYearChange(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="ml-1">Year</span>
        </Button>
        
        <select
          className="border rounded-md px-2 py-1 text-sm"
          value={currentDate.getFullYear()}
          onChange={handleSelectYear}
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleYearChange(1)}
        >
          <span className="mr-1">Year</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      <Calendar
        mode="single"
        selected={currentDate}
        onSelect={(date) => {
          if (date) {
            setCurrentDate(date);
            onSelect(date);
          }
        }}
        initialFocus
      />
    </div>
  );
}