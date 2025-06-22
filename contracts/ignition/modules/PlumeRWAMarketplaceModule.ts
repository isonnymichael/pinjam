import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const PLUME_PUSD_ADDRESS = "0xdddD73F5Df1F0DC31373357beAC77545dC5A6f3F";

const PlumeRWAMarketplaceModule = buildModule("PlumeRWAMarketplaceModule", (m) => {
  const plumeRWAMarketplace = m.contract("PlumeRWAMarketplace", [PLUME_PUSD_ADDRESS]);

  return { plumeRWAMarketplace };
});

export default PlumeRWAMarketplaceModule;
