import React, { useState, useEffect } from "react";
import { Table, Tag, Button, notification } from "antd";
import type { ColumnsType } from 'antd/es/table';
import { parseUnits, formatUnits } from "ethers";
import { useActiveAccount, useSendTransaction } from 'thirdweb/react';
import { getLoansByUser, repayLoan } from "../../contracts/loan";
import useAuthStore from '../../stores/authStore';
import { fetchTokens } from '../../lib/api'; 

interface RWAItem {
  id: string;
  name: string;
  image: string;
  value: number;
  quantity: number;
  unitPrice: number;
  decimals: any;
}

interface LoanType {
  loanId: bigint;
  key: string;
  asset: string;
  image: string;
  loanAmount: string;
  repayAmount: string;
  dueDate: string;
  status: string;
}

interface RepayLoanParams {
  loanId: bigint;
  repayAmount: bigint;
  account: any;
}

export const LoanInterface: React.FC = () => {
  const account = useActiveAccount();
  const address = account?.address;
  const { balance, setBalance } = useAuthStore();
  const [loans, setLoans] = useState<LoanType[]>([]);
  const [loading, setLoading] = useState(true);
  const [rwaList, setRwaList] = useState<RWAItem[]>([]);
  
  useEffect(() => {
    const _fetchTokensAndLoans = async () => {
      if (!address) return;

      setLoading(true);

      try {
        // 1. Fetch token list (RWA)
        const data = await fetchTokens(address);
        const items = data.walletTokenBalanceInfoArr || [];

        const formattedTokens = items
          .filter((item: any) => {
            if (item.token?.address === '0x0000000000000000000000000000000000000000') return false;
            if (!item.token?.priceUSD) return false;
            if (!item.holdings?.tokenBalance) return false;
            if (item.token?.tokenType !== 'erc20') return false;
            return true;
          })
          .map((item: any, idx: number) => {
            const qty = parseFloat(item.holdings.tokenBalance);
            const price = parseFloat(item.token.priceUSD);

            const image = item.token.imageSmallUrl?.startsWith('https')
              ? item.token.imageSmallUrl
              : 'https://placehold.co/40x40?text=RWA';

            return {
              id: item.token.address || `${idx}`,
              name: item.token.symbol,
              image: image,
              quantity: qty,
              unitPrice: parseFloat(price.toFixed(3)),
              value: parseFloat((qty * price).toFixed(3)),
              decimals: item.token.decimals,
            };
          });

        setRwaList(formattedTokens);

        // 2. Fetch loans after token list is ready
        const rawLoans = await getLoansByUser(address);

        const mappedLoans = rawLoans.map((loan) => {
          const token = formattedTokens.find(
            (t: any) => t.id.toLowerCase() === loan.collateralToken.toLowerCase()
          );

          const symbol = token?.name || loan.collateralToken.slice(0, 6) + '...';
          const decimals = token?.decimals || 18;

          const formattedCollateralAmount = formatUnits(loan.collateralAmount.toString(), parseInt(decimals));
          const formattedLoanAmount = formatUnits(loan.amount, 6);
          const formattedRepayAmount = formatUnits(loan.repayAmount, 6);
          const formattedDate = new Date(Number(loan.dueDate) * 1000).toLocaleDateString();

          let status = "Active";
          if (loan.repaid) {
            status = "Repaid";
          } else if (loan.overdue) {
            status = "Overdue";
          }

          const image = token?.image || 'https://placehold.co/40x40?text=RWA';

          return {
            loanId: loan.loanId,
            key: loan.loanId.toString(),
            asset: symbol,
            image,
            collateralAmount: `${formattedCollateralAmount}`,
            loanAmount: `${formattedLoanAmount} $pUSD`,
            repayAmount: `${formattedRepayAmount} $pUSD`,
            dueDate: formattedDate,
            status,
          };
        });

        setLoans(mappedLoans);
      } catch (err) {
        console.error("Error fetching tokens or loans:", err);
      } finally {
        setLoading(false);
      }
    };

    _fetchTokensAndLoans();
  }, [address, balance]);

  const activeLoanColumns: ColumnsType<LoanType> = [
    {
      title: 'Asset',
      dataIndex: 'asset',
      key: 'asset',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <img src={record.image} alt={record.asset} className="w-6 h-6 rounded-full" />
          <span>{record.asset}</span>
        </div>
      ),
    },
    {
      title: 'Collateral Amount',
      dataIndex: 'collateralAmount',
      key: 'collateralAmount',
    },
    {
      title: 'Loan Amount',
      dataIndex: 'loanAmount',
      key: 'loanAmount',
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'Active' ? 'green' : 'red'}>
          {status}
        </Tag>
      ),
    },
  ];

  const historyColumns: ColumnsType<LoanType> = [
    {
      title: 'Asset',
      dataIndex: 'asset',
      key: 'asset',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <img src={record.image} alt={record.asset} className="w-6 h-6 rounded-full" />
          <span>{record.asset}</span>
        </div>
      ),
    },
    {
      title: 'Collateral Amount',
      dataIndex: 'collateralAmount',
      key: 'collateralAmount',
    },
    {
      title: 'Loan Amount',
      dataIndex: 'loanAmount',
      key: 'loanAmount',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'Active' ? 'green' : 'red'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
    },
  ];

  return (
    <>
      <div className="mb-8 bg-white p-4">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">My Active Loans</h2>
        <Table
          columns={activeLoanColumns}
          dataSource={loans.filter(loan => loan.status === "Active")}
          pagination={false}
          className="rounded-lg overflow-hidden"
          locale={{
            emptyText: (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">You don't have any active loans</p>
              </div>
            )
          }}
        />
      </div>

      {loans.filter(loan => loan.status === "Active").length > 0 && (
        <RepaySection
          account={account}
          loans={loans.filter(loan => loan.status === "Active")}
        />
      )}

      <div className="mt-12 bg-white p-4">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">Loan Overdue History</h2>
        <Table
            columns={historyColumns}
            dataSource={loans.filter(loan => loan.status !== "Active")}
            pagination={false}
            className="rounded-lg overflow-hidden"
            locale={{
                emptyText: (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No loan overdue history</p>
                </div>
                )
            }}
        />
      </div>
    </>
  );
};

const RepaySection: React.FC<{
  account: any;
  loans: LoanType[];
}> = ({ account, loans }) => (
  <div className="bg-red-50 p-6 rounded-lg border border-red-100">
    <h3 className="text-xl font-semibold mb-4 text-red-500">Loan Repayment</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {loans.map((loan) => (
        <LoanRepayCard
          key={loan.key}
          loan={loan}
          account={account}
        />
      ))}
    </div>
  </div>
);

const LoanRepayCard: React.FC<{
  account: any;
  loan: LoanType;
}> = ({ account, loan}) => {
  const [loading, setLoading] = useState(false);
  const { balance, setBalance } = useAuthStore();
  const { mutate: sendTransaction, isPending } = useSendTransaction();

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <img src={loan.image} alt={loan.asset} className="w-6 h-6 rounded-full" />
          <h4 className="font-medium">{loan.asset}</h4>
        </div>
        <span className="text-sm text-gray-500">Due: {loan.dueDate}</span>
      </div>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-600">Amount: {loan.repayAmount}</p>
        </div>

        <Button
          type="primary"
          danger
          loading={loading || isPending}
          onClick={async () => {
            setLoading(true);
            try {
              const parsedAmount = parseUnits(loan.repayAmount.replace(" $pUSD", ""), 6);
              const tx = await repayLoan({
                loanId: BigInt(loan.loanId),
                repayAmount: parsedAmount,
                account,
              });

              await sendTransaction(tx as any, {
                onSuccess: (receipt: any) => {

                  notification.success({
                    message: "Loan repaid",
                    description: `Transaction: ${receipt.transactionHash}`,
                  });

                  setBalance(String(Number(balance) - Number(formatUnits(parsedAmount, 6))));
                },
                onError: (err: any) => {

                  notification.error({
                    message: "Repayment failed",
                    description: err.message || "Failed to repay loan",
                  });

                },
              });
            } catch (err: any) {
              console.error("Repayment error:", err);

              notification.error({
                message: "Error",
                description: err.message || "Something went wrong",
              });

            } finally {
              setLoading(false);
            }
          }}
        >
          Repay Now
        </Button>
      </div>
    </div>
  );
};
