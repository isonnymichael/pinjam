import { getContract, prepareContractCall, readContract, sendTransaction, waitForReceipt } from "thirdweb";
import { plumeMainnet } from '../lib/chain';
import { thirdWebClient } from '../lib/client';
import { parseUnits, formatUnits } from "ethers";

export interface LoanData {
  borrower: string;
  loanId: bigint;
  collateralToken: string;
  collateralAmount: bigint;
  amount: bigint;
  repayAmount: bigint;
  feeAmount: bigint;
  dueDate: bigint;
  repaid: boolean;
  overdue: boolean;
}

interface RepayLoanParams {
  loanId: bigint;
  repayAmount: bigint;
  account: any;
}

export const plumePawnContract = getContract({
    client: thirdWebClient,
    address: import.meta.env.VITE_PLUME_PAWN_CONTRACT,
    chain: plumeMainnet,
});

export async function getLTV(): Promise<string> {
  try {
    const ltv = await readContract({
      contract: plumePawnContract,
      method: "function LTV() view returns (uint256)",
    });
    
    return ltv.toString();
  } catch (error) {
    console.error("Failed to fetch LTV:", error);
    return '-';
  }
}

/**
 * Ensures allowance for the ERC20 token and submits a requestLoan transaction.
 * 
 * @param tokenAddress - ERC20 token address to be used as collateral.
 * @param amount - Human-readable token amount (e.g. "100.5").
 * @param loanAmount - The loan amount.
 * @param decimals - Number of decimals for the token (e.g. 6 or 18).
 * @param duration - Loan duration in seconds.
 * @param account - Wallet account from thirdweb (with `.address` field).
 */
export async function ensureAllowanceThenRequestLoan({
  tokenAddress,
  amount,
  loanAmount,
  decimals,
  duration,
  account,
}: {
  tokenAddress: string;
  amount: string;
  loanAmount: string;
  decimals: any;
  duration: any;
  account: any;
}) {
  const parsedAmount = parseUnits(amount.toString(), parseInt(decimals));

  const tokenContract = getContract({
    client: thirdWebClient,
    address: tokenAddress,
    chain: plumeMainnet,
  });

  // Check current allowance
  const allowance = await readContract({
    contract: tokenContract,
    method: "function allowance(address owner, address spender) view returns (uint256)",
    params: [account.address, import.meta.env.VITE_PLUME_PAWN_CONTRACT],
  }) as bigint;

  // If not enough allowance, approve first
  if (allowance < parsedAmount) {
    const approveTx = await prepareContractCall({
      contract: tokenContract,
      method: "function approve(address spender, uint256 amount)",
      params: [import.meta.env.VITE_PLUME_PAWN_CONTRACT, parsedAmount],
    });

    const { transactionHash } = await sendTransaction({
      account,
      transaction: approveTx,
    });

    await waitForReceipt({
      client: thirdWebClient,
      chain: plumeMainnet,
      transactionHash,
    });
  }

  // Prepare and send loan request
  const parsedDuration = BigInt(duration * 24 * 60 * 60);
  const parsedLoanAmount = parseUnits(loanAmount.toString(), 6);
  const requestLoanTx = await prepareContractCall({
    contract: plumePawnContract,
    method: "function requestLoan(address collateralToken, uint256 collateralAmount, uint256 loanAmount, uint256 duration)",
    params: [tokenAddress, parsedAmount, parsedLoanAmount, parsedDuration],
  });

  return requestLoanTx;
}

export async function getLoansByUser(address: string): Promise<LoanData[]> {
  try {
    const rawLoans = await readContract({
      contract: plumePawnContract,
      method: "function getLoansByUser(address user) view returns ((address,uint256,address,uint256,uint256,uint256,uint256,uint256,bool,bool)[])",
      params: [address],
    }) as readonly [
      string, bigint, string, bigint, bigint, bigint, bigint, bigint, boolean, boolean
    ][];

    const loans: LoanData[] = rawLoans.map((loan) => ({
      borrower: loan[0],
      loanId: loan[1],
      collateralToken: loan[2],
      collateralAmount: loan[3],
      amount: loan[4],
      repayAmount: loan[5],
      feeAmount: loan[6],
      dueDate: loan[7],
      repaid: loan[8],
      overdue: loan[9],
    }));

    return loans;
  } catch (error) {
    console.error("Failed to get loans by user:", error);
    return [];
  }
}

export async function repayLoan({ loanId, repayAmount, account }: RepayLoanParams) {
  // 1. Cek allowance
  const allowance = await readContract({
    contract: import.meta.env.VITE_TOKEN_CONTRACT,
    method: "function allowance(address owner, address spender) view returns (uint256)",
    params: [account.address, import.meta.env.VITE_PLUME_PAWN_CONTRACT],
  }) as bigint;

  if (allowance < repayAmount) {
    const approveTx = await prepareContractCall({
      contract: import.meta.env.VITE_TOKEN_CONTRACT,
      method: "function approve(address spender, uint256 amount)",
      params: [import.meta.env.VITE_PLUME_PAWN_CONTRACT, repayAmount],
    });

    const { transactionHash } = await sendTransaction({
      account,
      transaction: approveTx,
    });

    await waitForReceipt({
      client: thirdWebClient,
      chain: plumeMainnet,
      transactionHash,
    });
  }

  // 2. Kirim repayLoan
  const repayTx = await prepareContractCall({
    contract: plumePawnContract,
    method: "function repayLoan(uint256 loanId)",
    params: [loanId],
  });

  return repayTx;
}