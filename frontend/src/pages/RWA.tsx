import React, { useState } from 'react';
import { Form, Input, InputNumber, Button, Upload, Select, Tabs, notification } from "antd"
import { Spin } from 'antd';
import { UploadOutlined } from "@ant-design/icons"
import { upload } from "thirdweb/storage";
import { thirdWebClient } from '../lib/client';
import { useActiveAccount } from 'thirdweb/react'
import { mintRWA, getNFTs } from '../contracts/rwa'
import { listAsset } from '../contracts/marketplace'
import { formatCurrency } from '../lib/helper'
import { parseUnits } from "ethers";

const { TabPane } = Tabs;

const RWA: React.FC = () => {
    const [form] = Form.useForm();
    const [listForm] = Form.useForm();
    const account = useActiveAccount();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [nfts, setNfts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true)
    const selectedTokenId = Form.useWatch('tokenId', listForm);
    const selectedNFT = nfts.find(nft => nft.tokenId === selectedTokenId);

    const onFinish = async (values: any) => {
        const { name, ticker, amount, description, image } = values
        const file = image[0].originFileObj
        setIsSubmitting(true);
    
        if (!file) {
            notification.error({
                message: "Mint failed",
                description: "Image file not found!",
            });
            return
        }
    
        try {
            // First, upload the image and get its IPFS URL.
            const imageUri = await upload({
                client: thirdWebClient,
                files: [file]
            });
            
            // Then, upload the metadata, including the image URI.
            const metadataUri = await upload({
                client: thirdWebClient,
                files: [{
                name: `${name}_metadata.json`,
                data: JSON.stringify({
                    name,
                    description,
                    image: imageUri,
                    attributes: [
                        { trait_type: "Ticker", value: ticker },
                        { trait_type: "Amount", value: amount }
                    ]
                })
                }]
            });

            // How to directly access example:
            // https://ipfs.io/ipfs/QmQ2ZvrxD587GXdX9rctkurvtPG85j9cqZs9Lvp73jQs4a/plume_network1716480863760.png
            // https://ipfs.io/ipfs/Qme4tjYpXxxzQcyU7P72v87drhirK13S61GFLAqM7RxwgT/Asset%20Test_metadata.json

            const mintResult = await mintRWA(
                account,
                name,
                ticker,
                BigInt(amount),
                metadataUri
            );

            if (mintResult.status) {
                notification.success({
                    message: "Mint Successful",
                    description: (
                        <span>
                            RWA NFT minted successfully!  
                            <a 
                                href={`https://testnet-explorer.plumenetwork.xyz/tx/${mintResult.transactionHash}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ marginLeft: 8 }}
                            >
                                View transaction
                            </a>
                        </span>
                    ),
                    duration: 4.5,
                });
            } else {
                notification.error({
                    message: "Mint failed",
                    description: "Failed to mint RWA NFT!",
                });
            }
        } catch (err) {
            console.error(err)
            notification.error({
                message: "Mint failed",
                description: "Failed to mint RWA NFT!",
            });
        } finally {
            form.resetFields();
            setIsSubmitting(false);
        }
    }

    const onListSubmit = async (values: any) => {
        const { tokenId, pricePerUnit, amount} = values
        setIsSubmitting(true);
        const parsedPrice = parseUnits(pricePerUnit.toString(), 6);

        try {
            const result = await listAsset(
                account,
                BigInt(tokenId),
                parsedPrice,
                BigInt(amount)
            )

            if (result.status) {
                notification.success({
                  message: "Asset listed successfully!",
                  description: `TxHash: ${result.transactionHash}`,
                })
              } else {
                notification.error({
                  message: "Listing failed!",
                })
            }

        } catch (error) {
            console.error("Error during listing:", error)
            notification.error({
              message: "Listing failed!",
              description: "Unexpected error occurred.",
            })
          } finally {
            listForm.resetFields()
            setIsSubmitting(false)
        }
    };

    const normFile = (e: any) => {
        if (Array.isArray(e)) return e
        return e?.fileList
    }

    const fetchTokens = async () => {
        try {
          setLoading(true);
          const fetchedNFTs = await getNFTs(account?.address); 
          setNfts(fetchedNFTs);
        } catch (error) {
          console.error("Failed to fetch NFTs:", error);
          notification.error({
            message: "Error",
            description: "Failed to load NFT list",
          });
        } finally {
          setLoading(false);
        }
    };

    return (
        <div className="bg-[#F9F9F9] min-h-screen">
            <section className="bg-white text-black py-24 px-6 text-center font-sans">

            <Tabs defaultActiveKey="1" centered>
                <TabPane tab="Mint" key="1">
                    {/* MINT FORM */}
                    <div className="max-w-xl mx-auto bg-white shadow-xl rounded-2xl p-8 text-left">
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={onFinish}
                            initialValues={{ amount: undefined }}
                        >
                            <h2 className="text-2xl font-bold mb-6 text-center">Tokenize your physical assets in seconds</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Form.Item
                                    name="name"
                                    label="Asset Name"
                                    rules={[{ required: true, message: "Asset name is required" }]}
                                    className="md:col-span-1"
                                >
                                    <Input placeholder="e.g. Real Estate Bond" />
                                </Form.Item>

                                <Form.Item
                                    name="ticker"
                                    label="Ticker"
                                    rules={[{ required: true, message: "Ticker is required" }]}
                                    className="md:col-span-1"
                                >
                                    <Input placeholder="e.g. REB" />
                                </Form.Item>

                                <Form.Item
                                    name="amount"
                                    label="Token Supply"
                                    rules={[{ required: true, type: "number", min: 1 }]}
                                    className="md:col-span-1"
                                >
                                    <InputNumber 
                                        formatter={(value) => formatCurrency(value as any, false)}
                                        style={{ width: '100%' }} 
                                        min={1} 
                                        placeholder="e.g. 1000" 
                                    />
                                </Form.Item>
                            </div>

                            <Form.Item
                                name="description"
                                label="Description"
                                rules={[{ required: true, message: "Description is required" }]}
                            >
                                <Input.TextArea rows={4} placeholder="Enter asset description..." />
                            </Form.Item>

                            <Form.Item
                                name="image"
                                label="Asset Image"
                                valuePropName="fileList"
                                getValueFromEvent={normFile}
                                rules={[{ required: true, message: "Image is required" }]}
                            >
                                <Upload
                                    listType="picture-card"
                                    accept="image/*"
                                    maxCount={1}
                                    beforeUpload={() => false}
                                >
                                    <Button icon={<UploadOutlined />}></Button>
                                </Upload>
                            </Form.Item>

                            <Form.Item>
                                <Button
                                    type="primary"
                                    danger
                                    shape="round"
                                    htmlType="submit"
                                    className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl h-12 text-lg"
                                    loading={isSubmitting}
                                >
                                    Mint RWA NFT
                                </Button>
                            </Form.Item>
                        </Form>
                    </div>
                </TabPane>

                <TabPane tab="List" key="2">
                    {/* MARKETPLACE FORM */}
                    <div className="max-w-xl mx-auto bg-white shadow-xl rounded-2xl p-8 text-left">
                        <Form
                            form={listForm}
                            layout="vertical"
                            onFinish={onListSubmit}
                            initialValues={{ pricePerUnit: undefined, amount: undefined }}
                        >
                            <h2 className="text-2xl font-bold mb-6 text-center">List Your Asset</h2>
                            
                            <Form.Item
                                name="tokenId"
                                label="Select Your RWA Asset"
                                rules={[{ required: true, message: "Please select an Asset" }]}
                            >
                                <Select
                                    placeholder="Select Asset to list"
                                    onDropdownVisibleChange={async (open) => {
                                        if (open ) {
                                            setNfts([]);

                                            await fetchTokens();
                                        }
                                    }}
                                    notFoundContent={loading ? <Spin size="small" /> : 'No RWAs found'}
                                    onChange={(value) => {
                                        const selectedNFT = nfts.find(nft => nft.tokenId === value);
                                        listForm.setFieldsValue({
                                            amount: undefined,
                                            maxAmount: selectedNFT?.ownerBalance || 0
                                        });
                                    }}
                                    optionLabelProp="label"
                                >
                                    {nfts.map(nft => (
                                        <Select.Option 
                                            key={nft.tokenId} 
                                            value={nft.tokenId}
                                            label={`${nft.name} (${nft.ticker})`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <img 
                                                    src={nft.imageUrl} 
                                                    alt={nft.name} 
                                                    className="w-8 h-8 rounded-md object-cover"
                                                />
                                                <div>
                                                    <div className="font-medium">{nft.name} ({nft.ticker})</div>
                                                    <div className="text-xs text-gray-500">
                                                        Balance: {formatCurrency(nft.ownerBalance as any, false)} • ID: #{nft.tokenId}
                                                    </div>
                                                </div>
                                            </div>
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item className="mb-0">
                                <div className="grid grid-cols-2 gap-4">
                                    <Form.Item
                                    name="pricePerUnit"
                                    label="Price per Unit (pUSD)"
                                    rules={[{ required: true, message: "Price is required" }]}
                                    className="mb-0"
                                    >
                                    <InputNumber 
                                        style={{ width: '100%' }} 
                                        placeholder="0.00"
                                        formatter={(value) => formatCurrency(value as any)}
                                    />
                                    </Form.Item>

                                    <Form.Item
                                        name="amount"
                                        label="Amount to List"
                                        rules={[
                                            { required: true, message: "Amount is required" },
                                            () => ({
                                            validator(_, value) {
                                                if (!selectedNFT || value <= selectedNFT.ownerBalance) {
                                                    return Promise.resolve();
                                                }
                                                return Promise.reject(new Error(`Cannot exceed balance (${selectedNFT?.ownerBalance || 0})`));
                                            },
                                            }),
                                        ]}
                                        >
                                        <div className="space-y-1">
                                            <InputNumber 
                                            min={1}
                                            max={selectedNFT?.ownerBalance || 1}
                                            style={{ width: '100%' }} 
                                            placeholder="Enter amount"
                                            />
                                            {selectedTokenId && (
                                            <div className="text-sm text-gray-500">
                                                Balance: {formatCurrency(selectedNFT?.ownerBalance, false) || 0}
                                            </div>
                                            )}
                                        </div>
                                    </Form.Item>
                                </div>
                            </Form.Item>

                            <Form.Item>
                                <Button
                                    type="primary"
                                    danger
                                    shape="round"
                                    htmlType="submit"
                                    className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl h-12 text-lg"
                                    loading={isSubmitting}
                                >
                                    List on Marketplace
                                </Button>
                            </Form.Item>
                        </Form>
                    </div>
                </TabPane>

            </Tabs>

            </section>
        </div>
    )
}

export default RWA
