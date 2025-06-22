import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectButton, useActiveAccount, useActiveWalletChain, useSwitchActiveWalletChain } from 'thirdweb/react';
import { LoadingOutlined } from '@ant-design/icons';
import { createWallet } from 'thirdweb/wallets';
import useAuthStore from '../stores/authStore';
import { plumeMainnet } from '../lib/chain';
import { thirdWebClient } from '../lib/client';

const wallets = [
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  createWallet('me.rainbow'),
];

const WalletConnect = () => {
  const navigate = useNavigate();
  const { login, logout, setAddress } = useAuthStore();
  const account = useActiveAccount();
  const chain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    if (account) {
      if (chain?.id === plumeMainnet.id) {
        login(account.address);
        setAddress(account.address);
      } else {
        logout();
        setAddress(null);
        navigate('/');
      }
    } else {
      logout();
      setAddress(null);
    }
  }, [account, chain, login, logout, setAddress, navigate]);

  return (
 <div>
      <ConnectButton
        client={thirdWebClient}
        wallets={wallets}
        chain={plumeMainnet}
        connectModal={{ size: 'compact' }}
        detailsModal={{
          hideSwitchWallet: true,
          hideSendFunds: true,
          hideReceiveFunds: true,
          hideBuyFunds: true,
          showTestnetFaucet: false,
          connectedAccountAvatarUrl: '',
          assetTabs: [],
          connectedAccountName: account ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : 'Connect Wallet',
        }}
        connectButton={{
          style: {
            borderRadius: '9999px',
            padding: '0.5rem 1rem',
            backgroundColor: '#eeeef0',
            color: 'hsl(230 11.63% 8.43%)',
            fontWeight: '600',
            border: 'none',
            cursor: 'pointer',
            height: '42px'
          },
          label: account ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : 'Connect Wallet'
        }}
        detailsButton={{
          render: () => {

            if (chain && chain.id !== plumeMainnet.id) {
                return ( <button
                  onClick={async (e) => {
                    try {
                      e.stopPropagation();
                      setIsSwitching(true);
                      await switchChain(plumeMainnet);
                    } catch (error) {
                      console.error("Failed to switch network:", error);
                    } finally {
                      setIsSwitching(false);
                    }
                  }}
                  style={{
                    borderRadius: '9999px',
                    padding: '0.5rem 1rem',
                    backgroundColor: '#eeeef0',
                    color: 'hsl(230 11.63% 8.43%)',
                    fontWeight: '600',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  disabled={isSwitching}
                >
                  {isSwitching ? (
                    <>
                      <LoadingOutlined style={{ fontSize: 16, marginRight: 14 }} />
                       Switching...
                    </>
                  ) : (
                    'Wrong Network'
                  )}
                </button>
                )
            }

            return (
              <button
                style={{
                  borderRadius: '9999px',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#eeeef0',
                  color: 'hsl(230 11.63% 8.43%)',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {account ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : 'Connected'}
              </button>
            );
          }
        }}
      />
    </div>
  );
};

export default WalletConnect;