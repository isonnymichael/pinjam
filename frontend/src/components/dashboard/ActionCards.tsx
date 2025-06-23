import { useState, useEffect } from 'react';
import { RequestLoanModal } from '../modals/RequestLoanModal';
import { AddLiquidityModal } from '../modals/AddLiquidityModal';
import useSettingStore from '../../stores/settingStore';
import { getAPR } from '../../contracts/deposit';
import { getLTV } from '../../contracts/loan';
import { Skeleton } from 'antd';

export const ActionCards = () => {
  const [loanModalVisible, setLoanModalVisible] = useState(false);
  const [liquidityModalVisible, setLiquidityModalVisible] = useState(false);

  const { APR, isAPRLoading, setAPR, setAPRLoading } = useSettingStore();
  const { LTV, isLTVLoading, setLTV, setLTVLoading } = useSettingStore();

  const updateAPR = async () => {
    const currentAPR = await getAPR();
    setAPR(currentAPR);
    setAPRLoading(false);
  };

  const updateLTV = async () => {
    const currentLTV = await getLTV();
    setLTV(currentLTV);
    setLTVLoading(false);
  };

  useEffect(() => {
    updateAPR();
    updateLTV();
  }, [APR, LTV]);

  const handleLoanSubmit = () => {
    setLoanModalVisible(false);
  };

  const handleLiquiditySubmit = () => {
    setLiquidityModalVisible(false);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div className="flex flex-col bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
          <div className="flex-grow">
            <h2 className="text-2xl font-bold text-red-500 mb-4">Need Liquidity?</h2>
            <p className="text-gray-600 mb-6">
              Pawn your RWA Assets to get instant loans while maintaining ownership.
            </p>
            <div className="mb-4">
              <p className="text-sm text-gray-500">Current LTV</p>
              {isLTVLoading ? (
                <Skeleton.Input 
                  active 
                  size="small" 
                  style={{ width: 60 }} 
                  className="[&_.ant-skeleton-input]:!h-6"
                />
              ) : (
                <p className="text-2xl font-bold text-red-600">
                  {LTV}%
                </p>
              )}
            </div>
          </div>
          <div>
            <button 
              onClick={() => setLoanModalVisible(true)}
              className="w-full cursor-pointer md:w-auto bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-6 rounded-full transition-colors"
            >
              Request Loan
            </button>
          </div>
        </div>

        <div className="flex flex-col bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
          <div className="flex-grow">
            <h2 className="text-2xl font-bold text-green-600 mb-4">Provide Liquidity</h2>
            <p className="text-gray-600 mb-6">
              Earn competitive yields by funding loans against verified RWA collateral.
            </p>
            <div className="mb-4">
              <p className="text-sm text-gray-500">Current Pool APY</p>
              {isAPRLoading ? (
                <Skeleton.Input 
                  active 
                  size="small" 
                  style={{ width: 60 }} 
                  className="[&_.ant-skeleton-input]:!h-6"
                />
              ) : (
                <p className="text-2xl font-bold text-green-600">
                  {APR}%
                </p>
              )}
            </div>
          </div>
          <div>
            <button 
              onClick={() => setLiquidityModalVisible(true)}
              className="w-full cursor-pointer md:w-auto bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-full transition-colors"
            >
              Add Liquidity
            </button>
          </div>
        </div>
      </div>

      <RequestLoanModal
        visible={loanModalVisible}
        onClose={() => setLoanModalVisible(false)}
        onSubmit={handleLoanSubmit}
      />

      <AddLiquidityModal
        visible={liquidityModalVisible}
        onClose={() => setLiquidityModalVisible(false)}
        onSubmit={handleLiquiditySubmit}
      />
    </>
  );
};