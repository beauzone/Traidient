import React from 'react';

interface HeadingProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function Heading({ 
  title, 
  description, 
  actions,
  className = "" 
}: HeadingProps) {
  return (
    <div className={`flex flex-col md:flex-row md:items-center md:justify-between mb-8 ${className}`}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="mt-4 md:mt-0 space-x-2">
          {actions}
        </div>
      )}
    </div>
  );
}