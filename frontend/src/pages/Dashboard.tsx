import React, { useEffect } from "react";
import { Tabs } from "antd";
import { DollarOutlined, SwapOutlined } from '@ant-design/icons';
import { ActionCards } from '../components/dashboard/ActionCards';
import { LoanInterface } from '../components/dashboard/Loan';
import { LiquidityInterface } from '../components/dashboard/Liquidity';
import useAuthStore from '../stores/authStore';
import { getTokenBalance } from '../contracts/token'
import { useActiveAccount } from 'thirdweb/react'

const { TabPane } = Tabs;

const Dashboard: React.FC = () => {
  const { balance, setBalance, setBalanceLoading } = useAuthStore();
  const account = useActiveAccount();

  useEffect(() => {
      const fetchBalance = async () => {
          if (account?.address) {
              const userBalance = await getTokenBalance(account?.address);
              setBalance(userBalance);
              setBalanceLoading(false);
          }
      };
      
      fetchBalance();
  }, [account, balance]);

  return (
    <div className="bg-[#F9F9F9] min-h-screen">
      <section className="text-black py-32 px-6 font-sans max-w-6xl mx-auto">
        <ActionCards />

        <Tabs defaultActiveKey="borrower" className="mb-8">
          <TabPane
            tab={
              <span className="flex items-center">
                <SwapOutlined className="mr-2" />
                Borrower
              </span>
            }
            key="borrower"
          >
            <LoanInterface />
          </TabPane>

          <TabPane
            tab={
              <span className="flex items-center">
                <DollarOutlined className="mr-2" />
                Liquidity Provider
              </span>
            }
            key="liquidity"
          >
            <LiquidityInterface />
          </TabPane>
        </Tabs>
      </section>
    </div>
  );
};

export default Dashboard;