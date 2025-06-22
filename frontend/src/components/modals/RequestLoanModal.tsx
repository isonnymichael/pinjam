import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Select, Row, Col, Divider, Checkbox, Typography, Spin, notification } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useActiveAccount, useSendTransaction } from 'thirdweb/react'
import { fetchTokens } from '../../lib/api'; 
import { ensureAllowanceThenRequestLoan } from '../../contracts/loan'
import useAuthStore from '../../stores/authStore';

const { Text } = Typography;

interface RWAItem {
  id: string;
  name: string;
  image: string;
  value: number;
  quantity: number;
  unitPrice: number;
  decimals: any;
}

interface RequestLoanModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: any) => void;
}

type DurationKey = '30' | '90' | '180';

export const RequestLoanModal: React.FC<RequestLoanModalProps> = ({ 
  visible, 
  onClose, 
  onSubmit
}) => {
  const [form] = Form.useForm();
  const [selectedAsset, setSelectedAsset] = useState<RWAItem | null>(null);
  const [duration, setDuration] = useState<DurationKey>('30');
  const [quantity, setQuantity] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [rwaList, setRwaList] = useState<RWAItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const account = useActiveAccount();
  const { mutate: sendTransaction, isPending } = useSendTransaction();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { balance, setBalance } = useAuthStore();

  const interestRates: Record<DurationKey, number> = {
    '30': 6,
    '90': 9,
    '180': 12
  };

  useEffect(() => {
    if (!visible) {
      form.resetFields();
      setSelectedAsset(null);
      setAgreed(false);
      setQuantity(0);
      setDuration('30');
    }
  }, [visible]);

  useEffect(() => {
    if (dropdownOpen && rwaList.length === 0) {
      fetchData();
    }
  }, [dropdownOpen]);

  const fetchData = async () => {
    try {
      if (!account?.address) {
        notification.success({
          message: "Wallet not connected",
          description: `Cannot fetch NFTs.`,
        });

        return;
      }

      setLoading(true);
      const data = await fetchTokens(account?.address);
      const items = data.walletTokenBalanceInfoArr || [];
      const formatted = items
        .filter((item: any) => {
          if (item.token?.address === '0x0000000000000000000000000000000000000000') return false;

          if (!item.token?.priceUSD) return false;

          if (!item.holdings?.tokenBalance) return false;

          if(item.token?.tokenType !== 'erc20') return false;

          return true;
        })
        .map((item: any, idx: number) => {
          const qty = parseFloat(item.holdings.tokenBalance);
          const price = parseFloat(item.token.priceUSD);
          
          // 2. Use placeholder if image URL is not https
          const image = item.token.imageSmallUrl?.startsWith('https')
            ? item.token.imageSmallUrl
            : 'https://placehold.co/40x40?text=RWA';

          return {
            id: item.token.address || `${idx}`,
            name: item.token.name,
            image: image,
            quantity: qty,
            unitPrice: parseFloat(price.toFixed(3)), // 5. Use 3 decimal places
            value: parseFloat((qty * price).toFixed(3)),
            decimals: item.token.decimals,
          };
        });

      setRwaList(formatted);
    } catch (err) {
      console.error('Error fetching NFTs:', err);
      setRwaList([]);
    } finally {
      setLoading(false);
    }
  };

  const calculatePayment = () => {
    if (!selectedAsset || !quantity || quantity <= 0) return null;
    
    const loanAmount = quantity * selectedAsset.unitPrice * 0.7;
    const interestRate = interestRates[duration];
    const interestAmount = (loanAmount * interestRate) / 100;
    
    return {
      principal: loanAmount,
      interest: interestAmount,
      total: loanAmount + interestAmount,
      rate: interestRate
    };
  };

  const paymentDetails = calculatePayment();

  return (
    <Modal
      title="Request New Loan"
      visible={visible}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          onClick={() => form.submit()}
          className="bg-red-500 hover:bg-red-600 border-none"
          disabled={!agreed || !selectedAsset}
          loading={isSubmitting || isPending}
        >
          Submit Request
        </Button>,
      ]}
    >
      <Form 
        form={form} 
        layout="vertical" 
        onFinish={ async (values) => {
          setIsSubmitting(true);
          // check the forms values to send.
          const asset = rwaList.find(item => item.id === values.asset);

          try {
            const tx = await ensureAllowanceThenRequestLoan({ tokenAddress: values.asset, amount: values.quantity, loanAmount: values.amount, decimals: asset?.decimals, duration: values.duration, account: account });
            await sendTransaction(tx as any, {
              onSuccess: (receipt) => {
                notification.success({
                  message: "Loan requested",
                  description: `Successfully requested ${values.amount} loan: ${receipt.transactionHash}`,
                });

                onSubmit({ ...values, paymentDetails });
                form.resetFields();
                setSelectedAsset(null);
                setAgreed(false);
                setDuration('30');

                setBalance(String(parseFloat(balance ?? '0') + parseFloat(values.amount)));
              },
              onError: (error) => {
                notification.error({
                  message: "Transaction Failed",
                  description: error.message || "Failed to request loan",
                });
              },
            });
          } catch (err) {
            console.error("Failed to request loan:", err);
          } finally {
            setIsSubmitting(false);
          }

        }}
      >
        <Row gutter={[16, 16]} wrap>
          <Col xs={24} md={12}>
            <Form.Item
              name="asset"
              label="Collateral Asset"
              rules={[{ required: true, message: 'Please select an asset' }]}
            >
              <Select
                placeholder="Select Asset"
                onChange={(value) => {
                  const asset = rwaList.find(item => item.id === value);
                  setSelectedAsset(asset || null);
                  form.setFieldsValue({ duration: '30' });
                  form.setFieldsValue({ quantity: asset?.quantity });
                }}
                optionLabelProp="label"
                onDropdownVisibleChange={(open) => setDropdownOpen(open)}
                notFoundContent={loading ? <Spin size="small" /> : 'No Assets found'}
              >
                {rwaList.map(rwa => (
                  <Select.Option 
                    key={rwa.id} 
                    value={rwa.id}
                    label={
                      <div className="flex items-center">
                        <img 
                          src={rwa.image} 
                          alt={rwa.name} 
                          className="w-5 h-5 mr-2 rounded"
                        />
                        {rwa.name} (${rwa.unitPrice})
                      </div>
                    }
                    disabled={rwa.value === 0}
                  >
                    <div className="flex items-center">
                      <img 
                        src={rwa.image} 
                        alt={rwa.name} 
                        className="w-6 h-6 mr-2 rounded"
                      />
                      {rwa.name} ({rwa.unitPrice}$)
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="quantity"
              label="Amount"
              rules={[
                {
                  validator: (_, value) => {
                    if (!selectedAsset) return Promise.reject('Select asset first');
                    if (value > selectedAsset.quantity) return Promise.reject(`Max is ${selectedAsset.quantity}`);
                    if (value <= 0) return Promise.reject('Must be at least 1');
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <div className="space-y-1">
                <Input
                  type="number"
                  max={selectedAsset?.quantity || 1}
                  placeholder="Enter token amount"
                  onChange={(e) => {
                    const qty = parseFloat(e.target.value || '0');
                    setQuantity(qty);
                    const loan = qty * (selectedAsset?.unitPrice || 0) * 0.7;
                    form.setFieldsValue({ amount: loan });
                  }}
                  disabled={!selectedAsset}
                />
                <Text type="secondary" className="text-xs block text-right">
                  Balance: {selectedAsset?.quantity || 0}
                </Text>
              </div>
            </Form.Item>

            <Form.Item
              name="amount"
              label="Loan Amount (pUSD)"
            >
              <Input 
                type="number" 
                placeholder="Will auto-calculate" 
                readOnly 
                className="bg-gray-50"
              />
            </Form.Item>

            <Form.Item
              name="duration"
              label="Loan Duration"
              rules={[{ required: true, message: 'Please select duration' }]}
            >
              <Select
                placeholder="Select duration"
                onChange={(value: DurationKey) => setDuration(value)}
                value={duration}
              >
                <Select.Option value="30">1 Month (6%)</Select.Option>
                <Select.Option value="90">3 Months (9%)</Select.Option>
                <Select.Option value="180">6 Months (12%)</Select.Option>
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <div className="bg-gray-50 p-4 rounded-lg h-full">
              <h4 className="font-semibold mb-3">Loan Summary</h4>
              {paymentDetails ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Principal (70% of value):</span>
                    <span>${paymentDetails.principal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Interest ({paymentDetails.rate}%):</span>
                    <span>${paymentDetails.interest}</span>
                  </div>
                  <Divider className="my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>Total Repayment (pUSD):</span>
                    <span>${paymentDetails.total}</span>
                  </div>
                </div>
              ) : (
                <Text type="secondary">Select an asset to see loan details</Text>
              )}

              <Text type="danger" className="block mt-4 text-xs">
                <InfoCircleOutlined className="mr-1" />
                Late payments may result in liquidation of your RWA collateral
              </Text>
            </div>
          </Col>
        </Row>

        <Form.Item
          name="agreement"
          valuePropName="checked"
          rules={[
            {
              validator: (_, value) =>
                value ? Promise.resolve() : Promise.reject('You must agree to the terms'),
            },
          ]}
        >
          <Checkbox onChange={(e) => setAgreed(e.target.checked)}>
            I agree to the loan terms and understand the risks
          </Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
};