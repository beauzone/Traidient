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
        
        console.log('Fetched integrations:', integrations);
        
        // Transform integrations into accounts (in a real app, this would be its own endpoint)
        const accountsData: BrokerageAccount[] = integrations
          .filter((integration: any) => integration.provider === 'alpaca')
          .map((integration: any, index: number) => {
            // Determine account type from additional fields
            const accountType = integration.credentials?.additionalFields?.accountType === 'live' ? 'live' : 'paper';
            
            // Use description or make a descriptive name
            const name = integration.description || 
                        `Alpaca ${accountType === 'live' ? 'Live' : 'Paper'} Account ${index + 1}`;
            
            return {
              id: integration.id,
              name: name,
              accountNumber: `ALP-${integration.id}`,
              accountType: accountType,
              balance: 10000.00, // Placeholder until we can fetch real balance
              provider: 'Alpaca',
              performance: 4.34, // Placeholder until we can fetch real performance
            };
          });
          
        // If we don't have any accounts, add a demo account just for UI demonstration
        if (accountsData.length === 0) {
          accountsData.push({
            id: 1,
            name: 'Account 1',
            accountNumber: 'DEMO-001',
            accountType: 'paper',
            balance: 1809.68,
            provider: 'Alpaca',
            performance: 4.34,
          });
        }
        
        console.log('Processed accounts:', accountsData);
        setAccounts(accountsData);
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
        // Fallback to a demo account if API fails
        setAccounts([{
          id: 1,
          name: 'Account 1',
          accountNumber: 'DEMO-001',
          accountType: 'paper',
          balance: 1809.68,
          provider: 'Alpaca',
          performance: 4.34,
        }]);
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