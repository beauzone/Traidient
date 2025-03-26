import { useEffect } from 'react';

/**
 * A hook that sets the document title
 * @param title The title to set for the page
 * @param suffix An optional suffix to append to the title (e.g. " | My App")
 */
export function useTitle(title: string, suffix: string = ' | TradingAI') {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title + suffix;
    
    return () => {
      document.title = previousTitle;
    };
  }, [title, suffix]);
}