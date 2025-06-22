import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const PLUME_PUSD_ADDRESS = "0xdddD73F5Df1F0DC31373357beAC77545dC5A6f3F";

const PlumePawnModule = buildModule("PlumePawnModule", (m) => {

  const pawn = m.contract("PlumePawn", [PLUME_PUSD_ADDRESS]);

  return { pawn };
});

export default PlumePawnModule;
