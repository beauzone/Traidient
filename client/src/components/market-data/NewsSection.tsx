import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NewsItem {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  summary?: string;
  imageUrl?: string;
}

interface NewsSectionProps {
  symbol: string;
}

const NewsSection: React.FC<NewsSectionProps> = ({ symbol }) => {
  const { data: newsItems, isLoading, error } = useQuery<NewsItem[]>({
    queryKey: [`/api/market-data/news?symbol=${symbol}`],
    enabled: !!symbol,
  });

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      
      if (diffHrs < 24) {
        return `${diffHrs} hours ago`;
      } else {
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric'
        });
      }
    } catch (err) {
      return 'Recent';
    }
  };

  if (error) {
    console.error("Error loading news data:", error);
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl">News</CardTitle>
        <Button variant="ghost" size="sm" className="gap-1 text-sm" asChild>
          <a href={`https://finance.yahoo.com/quote/${symbol}/news`} target="_blank" rel="noopener noreferrer">
            View all news <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !newsItems || newsItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No recent news available for {symbol}</p>
            <p className="text-sm mt-1">Check Yahoo Finance for the latest updates</p>
          </div>
        ) : (
          <div className="space-y-4">
            {newsItems.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && <Separator className="my-4" />}
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block hover:bg-muted/30 rounded-lg transition-colors duration-200 -mx-2 px-2 py-1"
                >
                  <div className="flex gap-4">
                    {item.imageUrl && (
                      <div className="hidden sm:block flex-shrink-0">
                        <img 
                          src={item.imageUrl} 
                          alt={item.title} 
                          className="w-24 h-24 object-cover rounded-md"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-md mb-1">{item.title}</h3>
                      {item.summary && item.summary !== item.title && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {item.summary}
                        </p>
                      )}
                      <div className="flex items-center text-xs text-muted-foreground">
                        <span className="font-medium">{item.source}</span>
                        <span className="mx-2">•</span>
                        <span>{formatDate(item.publishedAt)}</span>
                      </div>
                    </div>
                  </div>
                </a>
              </React.Fragment>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NewsSection;