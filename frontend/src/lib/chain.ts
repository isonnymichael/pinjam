// lib/chains.ts
import { defineChain } from 'thirdweb/chains';

export const plumeMainnet = defineChain({
  id: 98866,
  name: "Plume",
  rpc: "https://rpc.plume.org",
  nativeCurrency: { 
    name: "PLUME", 
    symbol: "$PLUME", 
    decimals: 18 
  },
  blockExplorers: [{
    name: "Plume Explorer",
    url: "https//explorer.plume.org"
  }],
});

export const chain = {
  plumeMainnet
};