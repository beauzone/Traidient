import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

interface NewsItem {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  summary: string;
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
  };

  if (error) {
    console.error("Error loading news data:", error);
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl flex items-center justify-between">
          News
          <span className="text-sm text-muted-foreground font-normal">
            Latest updates for {symbol}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !newsItems || newsItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recent news available for {symbol}
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
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-md mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {item.summary}
                      </p>
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