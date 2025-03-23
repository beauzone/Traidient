import { cn } from "@/lib/utils";

interface HeadingProps {
  title: string;
  description?: string;
  className?: string;
  actions?: React.ReactNode;
}

export function Heading({
  title,
  description,
  className,
  actions
}: HeadingProps) {
  return (
    <div className={cn(
      "flex items-center justify-between mb-4 gap-x-2",
      className
    )}>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="ml-auto flex items-center gap-x-2">
          {actions}
        </div>
      )}
    </div>
  );
}