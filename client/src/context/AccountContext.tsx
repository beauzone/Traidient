import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { fetchData } from '@/lib/api';

export interface BrokerageAccount {
  id: number;
  name: string;
  accountNumber: string;
  accountType: 'live' | 'paper';
  balance: number;
  provider: string;
  performance?: number;
}

interface AccountContextType {
  selectedAccount: string | null;
  setSelectedAccount: (accountId: string | null) => void;
  accounts: BrokerageAccount[];
  isLoadingAccounts: boolean;
}

export const AccountContext = createContext<AccountContextType>({
  selectedAccount: null,
  setSelectedAccount: () => {},
  accounts: [],
  isLoadingAccounts: false,
});

export const useAccountContext = () => useContext(AccountContext);

interface AccountProviderProps {
  children: ReactNode;
}

export const AccountProvider = ({ children }: AccountProviderProps) => {
  const [accounts, setAccounts] = useState<BrokerageAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>("all");
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  // Fetch accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      setIsLoadingAccounts(true);
      try {
        // This would typically fetch from an actual endpoint like '/api/brokerage-accounts'
        // For now, we'll use the integration endpoint as a placeholder
        const integrations = await fetchData('/api/integrations');
        
        // Transform integrations into accounts (in a real app, this would be its own endpoint)
        const accountsData: BrokerageAccount[] = integrations
          .filter((integration: any) => integration.provider === 'alpaca')
          .map((integration: any, index: number) => ({
            id: integration.id,
            name: integration.description || `Account ${index + 1}`,
            accountNumber: integration.id.toString(),
            accountType: integration.config?.paper ? 'paper' : 'live',
            balance: Math.random() * 10000, // This would come from real data
            provider: 'Alpaca',
            performance: (Math.random() * 2 - 1) * 5, // Random performance between -5% and +5%
          }));
          
        setAccounts(accountsData);
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, []);

  return (
    <AccountContext.Provider value={{ selectedAccount, setSelectedAccount, accounts, isLoadingAccounts }}>
      {children}
    </AccountContext.Provider>
  );
};