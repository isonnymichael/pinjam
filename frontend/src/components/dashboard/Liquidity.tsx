import React, { useState, useEffect } from "react";
import { Table, Button, Skeleton, Tooltip, notification } from "antd";
import type { ColumnsType } from 'antd/es/table';
import { DollarOutlined } from '@ant-design/icons';
import { LiquidityPosition } from '../../types/deposit';
import { useActiveAccount } from 'thirdweb/react';
import { getDepositsByUser, useWithdrawLiquidity  } from "../../contracts/deposit";
import useAuthStore from '../../stores/authStore';

export const LiquidityInterface: React.FC = () => {
  const account = useActiveAccount();
  const address = account?.address;
  const { balance, setBalance } = useAuthStore();

  const [positions, setPositions] = useState<LiquidityPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const { withdrawLiquidity } = useWithdrawLiquidity();

  useEffect(() => {
    const fetchDeposits = async () => {
      if (!address) return;

      setLoading(true);
      try {
        const deposits = await getDepositsByUser(address);
        setPositions(deposits);
      } catch (err) {
        console.error("Error fetching deposits:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDeposits();
  }, [address, balance]);

  // Liquidity provider columns.
  const liquidityColumns: ColumnsType<LiquidityPosition> = [
    {
      title: 'Amount Supplied',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => (
        <div className="flex items-center gap-2">
          <img
            src="https://token-media.defined.fi/98866_0xdddd73f5df1f0dc31373357beac77545dc5a6f3f_large_08f02aee-0ba8-42c9-a8ab-d90457159a7b.png"
            alt="$pUSD"
            className="w-6 h-6"
          />
          <span>{amount} $pUSD</span>
        </div>
      ),
    },
    {
      title: 'APR',
      dataIndex: 'apr',
      key: 'apr',
    },
    {
      title: 'Reward',
      dataIndex: 'unclaimedReward',
      key: 'unclaimedReward',
      render: (unclaimedReward) => `${unclaimedReward} $pUSD`,
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right',
      render: (_, record) => {
        const isDisabled = record.unclaimedReward === "0.0";
        
        return (
          <Tooltip 
            title={isDisabled ? "No rewards available to withdraw" : ""}
            placement="top"
          >
            <Button 
              loading={loadingId === record.depositId}
              className={`!px-3 !py-1 !rounded-full !border ${
                isDisabled 
                  ? "!text-gray-400 !border-gray-300 !bg-gray-100 cursor-not-allowed" 
                  : "!text-green-600 hover:!text-green-800 !border-gray-300 hover:!bg-gray-100"
              } transition-colors`}
              disabled={isDisabled}
              onClick={async () => {
                setLoadingId(record.depositId);
                
                if (!isDisabled) {
                  try {
                    const receipt = await withdrawLiquidity(record.depositId);
                    setBalance(String(parseFloat(balance ?? '0') + parseFloat(record.real_amount) + parseFloat(record.unclaimedReward)));
                    notification.success({
                      message: "Withdraw Successful",
                      description: `Withdrawn successfully: ${receipt.transactionHash} `,
                    });
                  } catch (err: any) {
                    notification.error({
                      message: "Withdraw Failed",
                      description: err || "Failed to add withdraw",
                    });
                  }  finally {
                    setLoadingId(null);
                  }
                }
              }}
            >
              Withdraw
            </Button>
          </Tooltip>
        );
      }
    },
  ];

  const skeletonColumns = [
    {
      title: 'Amount',
      key: 'amount',
      render: () => <Skeleton.Input active size="small" style={{ width: 100 }} />,
    },
    {
      title: 'APR',
      key: 'apr',
      render: () => <Skeleton.Input active size="small" style={{ width: 60 }} />,
    },
    {
      title: 'Action',
      key: 'action',
      render: () => <Skeleton.Button active size="small" style={{ width: 80 }} />,
    },
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
      <h2 className="text-2xl font-bold text-green-600 mb-6">My Liquidity Positions</h2>
      {loading ? (
        <Table
          columns={skeletonColumns}
          dataSource={Array(3).fill({})} // 3 baris skeleton
          pagination={false}
          showHeader={true}
        />
      ) : (
      <Table
        columns={liquidityColumns}
        dataSource={positions}
        pagination={false}
        locale={{
            emptyText: (
            <div className="text-center py-8">
                <p className="text-gray-500 mb-4">You haven't supplied any tokens yet</p>
                <Button 
                type="primary" 
                icon={<DollarOutlined />}
                className="bg-green-600 hover:bg-green-700"
                >
                Supply Tokens Now
                </Button>
            </div>
            )
        }}
      />
      )}
    </div>
  );
};