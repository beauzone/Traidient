import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { fetchData } from '@/lib/api';

export interface BrokerageAccount {
  id: number;
  name: string;
  accountNumber: string;
  accountType: 'live' | 'paper';
  balance: number;
  equity?: number;
  portfolioValue?: number;
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

  useEffect(() => {
    const fetchAccounts = async () => {
      setIsLoadingAccounts(true);
      try {
        // Directly fetch accounts from the trading API endpoint
        const accountsData = await fetchData<BrokerageAccount[]>('/api/trading/account');

        if (accountsData && Array.isArray(accountsData) && accountsData.length > 0) {
          console.log('Fetched accounts:', accountsData);
          setAccounts(accountsData);
        } else {
          console.log('No accounts found');
          setAccounts([]);
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
        setAccounts([]);
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