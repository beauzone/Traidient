import { useEffect } from 'react';

/**
 * Custom hook for setting document title
 * @param title The title to set
 * @param suffix Optional suffix to append to the title (e.g. "- App Name")
 */
export function useTitle(title: string, suffix: string = '') {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = suffix ? `${title} ${suffix}` : title;

    // Clean up when unmounting
    return () => {
      document.title = previousTitle;
    };
  }, [title, suffix]);
}

export default useTitle;