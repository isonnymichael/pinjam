import { getContract, readContract, prepareContractCall, sendTransaction, resolveMethod } from "thirdweb";
import { plumeMainnet } from '../lib/chain';
import { thirdWebClient } from '../lib/client';
import { convertIpfsToUrl, fetchMetadata  } from '../lib/metadata';

export const plumeRwaContract = getContract({
    client: thirdWebClient,
    address: import.meta.env.VITE_RWA_CONTRACT,
    chain: plumeMainnet,
});

export async function mintRWA(
    account: any,
    name: string,
    ticker: string,
    amount: bigint,
    metadataURI: string
): Promise<{ status: boolean; transactionHash?: string; tokenId?: bigint }> {
    try {
        const transaction = prepareContractCall({
            contract: plumeRwaContract,
            method: resolveMethod("function mintRWA(string memory name, string memory ticker, uint256 amount, string memory metadataURI) external returns (uint256)"),
            params: [name, ticker, amount, metadataURI],
        });

        const { transactionHash } = await sendTransaction({
            transaction,
            account,
        });

        return {
            status: true,
            transactionHash,
        };
    } catch (error) {
        console.error("Failed to mint RWA:", error);
        return {
            status: false,
        };
    }
}

export async function getAssetInfo(tokenId: bigint, ownerAddress?: string): Promise<{
    name: string;
    ticker: string;
    maxSupply: bigint;
    currentSupply: bigint;
    metadataURI: string;
    ownerBalance?: bigint;
} | null> {
    try {
        const [name, ticker, maxSupply, currentSupply, metadataURI] = await readContract({
            contract: plumeRwaContract,
            method: resolveMethod("function assetInfo(uint256) view returns (string, string, uint256, uint256, string)"),
            params: [tokenId],
        });

        let ownerBalance: bigint | undefined;
        if (ownerAddress) {
          ownerBalance = await readContract({
            contract: plumeRwaContract,
            method: resolveMethod("function balanceOf(address,uint256) view returns (uint256)"),
            params: [ownerAddress, tokenId],
          }) as any;
        }

        return {
            name: name as string,
            ticker: ticker as string,
            maxSupply: maxSupply as bigint,
            currentSupply: currentSupply as bigint,
            metadataURI: metadataURI as string,
            ownerBalance
        };
    } catch (error) {
        console.error("Failed to fetch asset info:", error);
        return null;
    }
}

export async function getTokenCreator(tokenId: bigint): Promise<string | null> {
    try {
        const creator = await readContract({
            contract: plumeRwaContract,
            method: resolveMethod("function tokenCreators(uint256) view returns (address)"),
            params: [tokenId],
        });

        return creator as any;
    } catch (error) {
        console.error("Failed to fetch token creator:", error);
        return null;
    }
}

export async function getNFTs(ownerAddress?: string) {
    if (!ownerAddress) return [];

    const totalSupply = await readContract({
      contract: plumeRwaContract,
      method: "function nextTokenId() view returns (uint256)",
    });
  
    const nftItems = [];
    for (let i = 1; i < totalSupply; i++) {
        const balance = await readContract({
            contract: plumeRwaContract,
            method: "function balanceOf(address, uint256) view returns (uint256)",
            params: [ownerAddress, BigInt(i)]
        });

        if (balance > 0) {
            const assetInfo = await getAssetInfo(BigInt(i), ownerAddress);
            const creatorInfo = await getTokenCreator(BigInt(i));
    
            if (assetInfo) {
                const metadata = await fetchMetadata(assetInfo.metadataURI);
    
                if (metadata) {
                    nftItems.push({
                        tokenId: i,
                        name: metadata.name || assetInfo.name,
                        ticker: metadata.attributes?.find((a: any) => a.trait_type === "Ticker")?.value || assetInfo.ticker,
                        currentSupply: assetInfo.currentSupply.toString(),
                        maxSupply: assetInfo.maxSupply.toString(),
                        ownerBalance: assetInfo.ownerBalance?.toString() || "0",
                        imageUrl: convertIpfsToUrl(metadata.image),
                        description: metadata.description,
                        creator: creatorInfo,
                        metadata
                    });
                }
            }
        }

    }
    return nftItems;
}