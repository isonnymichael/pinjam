import { getContract } from "thirdweb";
import { getBalance } from "thirdweb/extensions/erc20";
import { plumeMainnet } from '../lib/chain';
import { thirdWebClient } from '../lib/client';

export const tokenContract = getContract({
    client: thirdWebClient,
    address: import.meta.env.VITE_TOKEN_CONTRACT,
    chain: plumeMainnet,
});

export const getTokenBalance = async (accountAddress: string): Promise<string> => {
    try {
        const balance = await getBalance({
            contract: tokenContract,
            address: accountAddress
        });

        return balance.displayValue;
    } catch (error) {
        console.error("Error fetching token balance:", error);
        return "0";
    }
};