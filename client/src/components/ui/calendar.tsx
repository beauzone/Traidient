import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  // Enable year selection by default
  const [displayedYear, setDisplayedYear] = React.useState<number>(
    props.selected instanceof Date ? props.selected.getFullYear() : new Date().getFullYear()
  );
  
  // Create a ref to store the onSelect handler
  const onSelectRef = React.useRef(props.onSelect);
  
  // Update the ref when props.onSelect changes
  React.useEffect(() => {
    onSelectRef.current = props.onSelect;
  }, [props.onSelect]);

  // Update displayed year when selected date changes
  React.useEffect(() => {
    if (props.selected instanceof Date) {
      setDisplayedYear(props.selected.getFullYear());
    }
  }, [props.selected]);

  // Create a wrapper for the onSelect handler
  const handleSelect = React.useCallback((date: Date | undefined) => {
    if (onSelectRef.current) {
      onSelectRef.current(date);
    }
  }, []);

  // Custom caption component with year navigation
  const CustomCaption = ({ displayMonth }: { displayMonth: Date }) => {
    const years = Array.from({ length: 30 }, (_, i) => displayedYear - 15 + i);
    
    const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newYear = parseInt(e.target.value);
      if (displayMonth) {
        const newDate = new Date(displayMonth);
        newDate.setFullYear(newYear);
        setDisplayedYear(newYear);
        
        // Update the displayed month in the calendar
        if (props.onMonthChange) {
          props.onMonthChange(newDate);
        }
      }
    };
    
    return (
      <div className="flex justify-between items-center pt-1 relative px-8">
        <div className="absolute left-1">
          <button
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
            )}
            onClick={() => {
              if (displayedYear > 1900) {
                setDisplayedYear(displayedYear - 1);
                if (displayMonth && props.onMonthChange) {
                  const newDate = new Date(displayMonth);
                  newDate.setFullYear(newDate.getFullYear() - 1);
                  props.onMonthChange(newDate);
                }
              }
            }}
            title="Previous Year"
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium">
            {displayMonth?.toLocaleString('default', { month: 'long' })}
          </span>
          <select
            className="text-sm bg-background border rounded px-1"
            value={displayedYear}
            onChange={handleYearChange}
            aria-label="Year"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        
        <div className="absolute right-1">
          <button 
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
            )}
            onClick={() => {
              if (displayedYear < 2100) {
                setDisplayedYear(displayedYear + 1);
                if (displayMonth && props.onMonthChange) {
                  const newDate = new Date(displayMonth);
                  newDate.setFullYear(newDate.getFullYear() + 1);
                  props.onMonthChange(newDate);
                }
              }
            }}
            title="Next Year"
            type="button"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "hidden", // Hide default caption label
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
        Caption: CustomCaption as any,
      }}
      selected={props.selected}
      onSelect={handleSelect}
      mode={props.mode}
      defaultMonth={props.defaultMonth}
      onMonthChange={props.onMonthChange}
      disabled={props.disabled}
      initialFocus={props.initialFocus}
      footer={props.footer}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
