import { getContract, prepareContractCall, readContract, sendTransaction, waitForReceipt } from "thirdweb";
import { useSendTransaction } from "thirdweb/react";
import { plumeMainnet } from '../lib/chain';
import { thirdWebClient } from '../lib/client';
import { parseUnits, formatUnits } from "ethers";
import { PrepareLiquidityArgs } from '../types/deposit';
import { tokenContract } from './token';

export const plumePawnContract = getContract({
    client: thirdWebClient,
    address: import.meta.env.VITE_PLUME_PAWN_CONTRACT,
    chain: plumeMainnet,
});

export async function getAPR(): Promise<string> {
  try {
    const apr = await readContract({
      contract: plumePawnContract,
      method: "function APR() view returns (uint256)",
    });
    
    return apr.toString();
  } catch (error) {
    console.error("Failed to fetch APR:", error);
    return '-';
  }
}

export async function ensureAllowanceThenAddLiquidity({
    amount,
    account,
  }: PrepareLiquidityArgs & { account: any }) {
    const parsedAmount = parseUnits(amount.toString(), 6);
  
    const allowance = await readContract({
      contract: tokenContract,
      method: "function allowance(address owner, address spender) view returns (uint256)",
      params: [account.address, import.meta.env.VITE_PLUME_PAWN_CONTRACT],
    }) as bigint;
  
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
  
    return await prepareContractCall({
      contract: plumePawnContract,
      method: "function addLiquidity(uint256 amount)",
      params: [parsedAmount],
    });
}

export async function getDepositsByUser(address: string) {
  try {

    const result: any[] = await readContract({
      contract: plumePawnContract,
      method: "function getDepositsByUser(address) view returns ((uint256 depositId, uint256 amount, uint256 feeAmount, uint256 apr, uint256 depositTimestamp, uint256 unclaimedReward, uint256 lastRewardCalculation, bool withdrawn)[])" as any,
      params: [address],
    });

    const sortedResult = [...result]
    .filter(d => !d.withdrawn)
    .sort((a, b) => 
      parseInt(b.depositTimestamp) - parseInt(a.depositTimestamp)
    );

    const resultMap =  sortedResult.map((d) => ({
      depositId: parseInt(d.depositId),
      token: 'pUSD',
      amount: parseFloat(formatUnits(d.amount, 6)) + parseFloat(formatUnits(d.feeAmount, 6)),
      real_amount: formatUnits(d.amount, 6),
      fee_amount: formatUnits(d.feeAmount, 6),
      apr: `${d.apr}%`,
      depositTimestamp: d.depositTimestamp,
      unclaimedReward: formatUnits(d.unclaimedReward, 6),
      lastRewardCalculation: d.lastRewardCalculation,
      withdrawn: d.withdrawn
    }));

    return resultMap;
  } catch (err) {
    console.error("Error fetching user deposits:", err);
    return [];
  }
}

export function useWithdrawLiquidity() {
  const { mutateAsync: sendTransaction, isPending } = useSendTransaction();

  const withdrawLiquidity = async (depositId: number) => {
    if (typeof depositId !== "number") {
      throw new Error("depositId must be a number");
    }

    const tx = prepareContractCall({
      contract: plumePawnContract,
      method: "function withdrawLiquidity(uint256 depositId) external",
      params: [BigInt(depositId)],
    });

    const receipt = await sendTransaction(tx);
    return receipt;
  };

  return { withdrawLiquidity, isWithdrawing: isPending };
}