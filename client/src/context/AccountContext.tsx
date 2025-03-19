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
        // Fetch Alpaca integrations
        const integrations = await fetchData('/api/integrations');
        console.log('Fetched integrations:', integrations);
        
        // Filter Alpaca integrations
        const alpacaIntegrations = integrations.filter((integration: any) => 
          integration.provider === 'alpaca'
        );
        
        if (alpacaIntegrations.length === 0) {
          console.log('No Alpaca integrations found');
          setAccounts([]);
          setIsLoadingAccounts(false);
          return;
        }

        try {
          // Try to fetch actual account data from Alpaca API - now returns an array
          const accountsData = await fetchData<BrokerageAccount[]>('/api/trading/account');
          
          // Check if we got account data
          if (accountsData && accountsData.length > 0) {
            console.log('Processed accounts with real data:', accountsData);
            setAccounts(accountsData);
            return; // We already have the accounts formatted correctly
          } else {
            throw new Error('No account data returned from API');
          }
        } catch (accountError) {
          console.error('Failed to fetch account data, using integration data only:', accountError);
          
          // Transform integrations into accounts without real account data
          const accountsData: BrokerageAccount[] = alpacaIntegrations.map((integration: any, index: number) => {
            // Determine account type from additional fields
            const accountType = integration.credentials?.additionalFields?.accountType === 'live' ? 'live' : 'paper';
            
            // Use description as account name, or additionalFields.accountName, or create a descriptive name if missing
            const name = integration.description || 
                         integration.credentials?.additionalFields?.accountName ||
                         `Alpaca ${accountType === 'live' ? 'Live' : 'Paper'} Account ${index + 1}`;
            
            return {
              id: integration.id,
              name: name,
              accountNumber: `ALP-${integration.id}`,
              accountType: accountType,
              balance: 0, // Unable to fetch real balance
              provider: 'Alpaca',
              performance: 0, // Unable to fetch real performance
            };
          });
          
          console.log('Processed accounts with integration data only:', accountsData);
          setAccounts(accountsData);
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
        setAccounts([]);
      } finally {
        setIsLoadingAccounts(false);
      }
    };
    
    // Account data now comes directly from the backend

    fetchAccounts();
  }, []);

  return (
    <AccountContext.Provider value={{ selectedAccount, setSelectedAccount, accounts, isLoadingAccounts }}>
      {children}
    </AccountContext.Provider>
  );
};