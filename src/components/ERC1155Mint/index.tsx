import { FC, useEffect, useState, useRef, ReactElement, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Spin, Button, List, message, Space, Card, Modal, notification, Table } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useConnect, useAccount, useSignMessage } from 'wagmi';
import { writeContract } from '@wagmi/core';
import { ethers } from 'ethers';

import { useAddCustomNet, useAddBSCTestNetAndSwitch } from '../../hooks/useAddCustomNet';
import { localStorageProvider } from '../../lib/localStorageProvider';

import { ERC1155TokenInfo } from '../ERC1155TokenInfo';
import { ERC1155TokenBalance } from '../ERC1155TokenBalance';
import { getFormatedAddress } from '../../lib/address';
import { useERC20TokenInfo } from '../../hooks/useERC20TokenInfo';

import CiviaERC1155Check from '../../../abi/CiviaERC1155Check.json';

import styles from './index.module.css';

const CIVIA_ERC20_CONTRACT_ADDRESS = '0xFB85425B4b9bd96AFAC83bb1f756B8A1b8B6A3Ae';

const localStorageProviderMap = localStorageProvider();

const { Column } = Table;

const useGetERCMessageUnMint = () => {
    const [data, setData] = useState<any[]>();
    const handleUploadFile = async () => {
        try {
            const options = {
                multiple: true
            };
            const fileHandles = await (window as any).showOpenFilePicker(options);
            const allContent = await Promise.all(
                fileHandles.map(async (fileHandle: any) => {
                    const file = await fileHandle.getFile();
                    console.log(file);
                    const content = await file.text();
                    return {
                        content,
                        name: file.name
                    };
                })
            );
            const arr = allContent.map(({ content, name }) => ({
                message_id: name,
                content
            }));
            setData(arr);
            console.log(arr);
        } catch (e) {
            console.log(e);
        }
    };

    const inputFile = useMemo(() => <div onClick={handleUploadFile} >Select checks</div>, []);

    return {
        data,
        isLoading: false,
        inputFile
    };
};

const TokenItem: FC<any> = ({ item, onSigned }) => {
    const locationSearch = new URLSearchParams(location.search);
    const searchCiviaWalletAddress = '0x0'; // getFormatedAddress(locationSearch.get('civiaAddress') as string);
    const [isLoaing, setIsLoading] = useState(false);
    const [step, setStep] = useState<0|1|-1>(0);
    const { data: signData, signMessage: metaMaskSignMessage } = useSignMessage({
        onSuccess: (res) => {
            setStep(1);
            onSigned({ signData: res });
            localStorageProviderMap.set(`${item.message_id}`, res);
        }
    });

    //
    const handleSignData = async () => {
        const { receiverAddr, tokenAddr, tokenId, beginId, endId, amt, issuerAddr } = item.content;
        const orderParts = [
            { value: tokenAddr, type: 'address' },
            { value: issuerAddr, type: 'address' },
            { value: receiverAddr, type: 'address' },
            { value: tokenId, type: 'uint256' },
            { value: beginId, type: 'uint256' },
            { value: endId, type: 'uint256' },
            { value: amt, type: 'uint256' }
        ];

        const types = orderParts.map(o => o.type);
        const values = orderParts.map(o => o.value);
        const hash = ethers.utils.solidityKeccak256(types, values);
        metaMaskSignMessage({ message: ethers.utils.arrayify(hash) as any });
    };
    //
    const handleDelSignData = async () => {
        localStorageProviderMap.delete(`${item.message_id}`);
        onSigned({ signData: undefined });
        setStep(0);
    };

    return step === 0 ? (<Button size='small' onClick={handleSignData}>Sign</Button>) : (<CheckOutlined className={styles.successIcon} onClick={handleDelSignData} />);
};

const ERC20CheckList: FC<any> = forwardRef((props, ref) => {
    const [api, contextHolder] = notification.useNotification();

    useImperativeHandle(ref, () => (
        {
            openNotification,
            destroy: () => {
                api.destroy(1);
            }
        }
    ));

    const openNotification = (placement: ReactElement) => {
        api.info({
            icon: null,
            message: 'Check list',
            description: props.children,
            duration: null,
            closeIcon: null,
            key: 1,
            placement: 'bottomRight'
        });
    };

    return (
        <>
            {contextHolder}
        </>
    );
});

//
const ERC20Mint: FC<any> = () => {
    const locationSearch = new URLSearchParams(location.search);
    const searchCiviaWalletAddress = '0x0';// getFormatedAddress(locationSearch.get('civiaAddress') as string);
    const searchERC20Token = locationSearch.get('erc20token') as string;
    const [isLoading, setIsLoading] = useState(true);
    const [messageList, setMessageList] = useState<Map<string, any[]>>(new Map());
    //
    const { isConnected: isMetaMaskConnected, address: metamaskAddress } = useAccount();
    const { connect: metaMaskConnect, connectors: metaMaskConnectors, error: ucError, isLoading: ucIsLoading, pendingConnector } = useConnect();
    const connectMetamaskRef = useRef(false);
    const [modal, modalContextHolder] = Modal.useModal();

    const { chainId, switchBscTestNet } = useAddBSCTestNetAndSwitch();

    // auto connect metamask
    if (!connectMetamaskRef.current && !metamaskAddress && metaMaskConnectors && metaMaskConnectors.length) {
        connectMetamaskRef.current = true;
        metaMaskConnect({ connector: metaMaskConnectors[0] });
    }

    const [messageApi, contextHolder] = message.useMessage();

    const checkListRef = useRef();

    const filterMessageList = Array.from(messageList.values());

    const checkedMessageList = filterMessageList.filter((item) => {
        return item.every((su: any) => su.customContent);
    });

    const { data: unMintMessageData, isLoading: isLoadingUnMintMessageData, inputFile } = useGetERCMessageUnMint();

    useEffect(() => {
        setIsLoading(isLoadingUnMintMessageData);
    }, [isLoadingUnMintMessageData]);

    useEffect(() => {
        if (unMintMessageData && unMintMessageData.length) {
            const newMessageMapList = unMintMessageData.reduce((newML: Map<string, any>, item: any, index: number) => {
                const content = JSON.parse(item.content);
                const tokenAddr = content.tokenAddr;
                const newMLItem = newML.get(tokenAddr) || [];
                newMLItem.push({
                    ...item,
                    content
                });
                newML.set(tokenAddr, newMLItem.sort((a: any, b: any) => {
                    return a.content.beginId > b.content.endId ? 1 : -1;
                }));
                return newML;
            }, new Map());
            setMessageList(newMessageMapList);
        }
    }, [unMintMessageData]);

    useEffect(() => {
        if (checkedMessageList.length) {
            setTimeout((checkListRef.current as any).openNotification, 300);
        }
    }, [checkedMessageList.length]);

    const handlePackAll = async (tokenAddress: string) => {
        return modal.info({
            title: 'Bundle request sent',
            onOk: () => {
                window.location.reload();
            }
        });
        //
        // const messageItems = messageList.get(tokenAddress);
        // const messageIds = messageItems!.map((item: any) => item.message_id);
        // setIsLoading(true);
        // const res = await leaveMessagePackERC20(searchCiviaWalletAddress, messageIds).then(() => {
        //     messageApi.open({
        //         type: 'success',
        //         content: 'Check bundle send to issure'
        //     });
        // }).catch((err) => {
        //     console.log(err);
        // }).finally(() => {
        //     setIsLoading(false);
        // });
    };

    const handleSignedCreater = (tokenAddress: string, itemIndex: number) => {
        return (signedInfo: {signData: string, [k:string]: any}) => {
            const newMessageList = new Map(messageList);
            const subItems = newMessageList.get(tokenAddress);
            subItems![itemIndex].customContent = {
                ...(subItems![itemIndex].customContent || {}),
                signData: signedInfo.signData
            };
            newMessageList.set(tokenAddress, subItems!);
            setMessageList(newMessageList);
        };
    };

    const handleBatchMint = async () => {
        console.log(checkedMessageList);
        const getOneContractArgs = (item: any) => {
            const { issuerAddr, receiverAddr, tokenAddr, tokenId, beginId, endId, amt, sig } = item.content;
            const sigHex = item.customContent.signData.substring(2);
            const receiverR = '0x' + sigHex.slice(0, 64);
            const receiverS = '0x' + sigHex.slice(64, 128);
            const receiverV = parseInt(sigHex.slice(128, 130), 16);

            // return [addrs, senders, users, beginIds, endIds, amounts, v, r_s];
            const checks = [{
                tokenAddr,
                issuerAddr,
                receiverAddr,
                tokenId,
                beginId,
                endId,
                amt
            }];
            const v1 = [sig.v];
            const r1 = [sig.r];
            const s1 = [sig.s];
            const v2 = [receiverV];
            const r2 = [receiverR];
            const s2 = [receiverS];

            return [checks, v1, r1, s1, v2, r2, s2];
        };

        const mergedContractArgs = checkedMessageList.flat().reduce(([preChecks, preV1, preR1, preS1, preV2, preR2, preS2], subItem: any) => {
            const [checks, v1, r1, s1, v2, r2, s2] = getOneContractArgs(subItem);
            return [preChecks.concat(checks), preV1.concat(v1), preR1.concat(r1), preS1.concat(s1), preV2.concat(v2), preR2.concat(r2), preS2.concat(s2)];
        }, [[], [], [], [], [], [], []]);

        console.log(mergedContractArgs);

        setIsLoading(true);
        const res = await writeContract({
            address: CIVIA_ERC20_CONTRACT_ADDRESS,
            abi: CiviaERC1155Check.abi,
            functionName: 'mint',
            args: mergedContractArgs
        }).then(() => {
            // checkedMessageList.flat().forEach(({ message_id }) => {
            //     userMintERC20Done(searchCiviaWalletAddress, [message_id]);
            // });
            messageApi.open({
                type: 'success',
                content: 'Success'
            });
            location.reload();
            // (checkListRef.current as any).destroy();
            return true;
        }).catch((err) => {
            const errStr = String(err);
            const isStartIdNotMatch = /start id not match/.test(errStr);
            const isDenied = /MetaMask Tx Signature: User denied transaction signature/.test(errStr);
            console.log(err);
            messageApi.open({
                type: 'error',
                content: isStartIdNotMatch ? 'start id not match' : (isDenied ? 'MetaMask Tx Signature: User denied transaction signature' : errStr)
            });
            setIsLoading(false);
        }).finally(() => {
            setIsLoading(false);
        });
    };

    return (
        <>
            <Spin spinning={isLoading}>
                {contextHolder}
                {modalContextHolder}
                <div className={styles.body}>
                    <div style={{ textAlign: 'center' }}><Button>{inputFile}</Button></div>
                    <br /><br />
                    <List style={{ visibility: filterMessageList.length ? 'initial' : 'hidden' }}>
                        {
                            filterMessageList.map((item: any, index: number) => {
                                return (
                                    <div key={item[0].content.tokenAddr}>
                                        <Table
                                            title={() => (
                                                <h3>
                                                    <ERC1155TokenInfo tokenAddress={item[0].content.tokenAddr}>
                                                        {
                                                            (tokeName: string, tokenSymbol: string, formatAddr: string) => {
                                                                return <span><label className={styles.label}>Token:</label>{`${tokeName} (${tokenSymbol}) ${formatAddr}`}&nbsp;&nbsp;</span>;
                                                            }
                                                        }
                                                    </ERC1155TokenInfo>
                                                    <span style={{ float: 'right' }}>
                                                        {
                                                            item.length > 1 ? <Button type="link" onClick={() => { handlePackAll(item[0].content.tokenAddr); }}>Bundle checks</Button> : null
                                                        }
                                                    </span>
                                                </h3>
                                            )}
                                            bordered
                                            dataSource={
                                                item.map((subItem: any, subIndex: number) => {
                                                    const { beginId, endId, tokenId, amt } = subItem.content;
                                                    return {
                                                        tokenId,
                                                        amount: amt,
                                                        checkId: beginId === endId ? beginId : `${beginId}-${endId}`,
                                                        signBtn: <TokenItem item={subItem} onSigned={handleSignedCreater(subItem.content.tokenAddr, subIndex)} />
                                                    };
                                                })
                                            }
                                            pagination={false}
                                            style={{ width: '100%' }}
                                        >
                                            <Column title="Token Id" dataIndex="tokenId" key="tokenId" width={160} />
                                            <Column title="Check Id" dataIndex="checkId" key="checkId" width={160} />
                                            <Column title="Amount" dataIndex="amount" key="amount" width={160} />
                                            <Column title="" dataIndex="signBtn" key="signBtn" align="right" />
                                        </Table>
                                        <br />
                                    </div>
                                );
                            })
                        }
                    </List>
                    {
                        // filterMessageList.length === 0 ? <div style={{ textAlign: 'center' }}><Button>{inputFile}</Button></div> : null
                    }
                </div>

                <ERC20CheckList ref={checkListRef}>
                    {
                        checkedMessageList.length ? (
                            <div className={styles.floatFooter}>
                                <div>
                                    <div className={styles.shopCard}>
                                        <List>
                                            {
                                                checkedMessageList.map((item: any, index: number) => {
                                                    return <List.Item key={index}>
                                                        <ERC1155TokenInfo tokenAddress={item[0].content.tokenAddr}>
                                                            {
                                                                (tokeName: string, tokenSymbol: string, formatAddr: string) => {
                                                                    return <div><label className={styles.label}>Token:</label>{`${tokeName} (${tokenSymbol}) ${formatAddr}`}</div>;
                                                                }
                                                            }
                                                        </ERC1155TokenInfo>
                                                    </List.Item>;
                                                })
                                            }
                                            <List.Item>
                                                <div className={styles.batchButton}>
                                                    <Space>
                                                        <Button type='primary' onClick={handleBatchMint}>Batch mint</Button>
                                                    </Space>
                                                </div>
                                            </List.Item>
                                        </List>
                                    </div>
                                </div>
                            </div>
                        ) : null
                    }
                </ERC20CheckList>
            </Spin>
        </>
    );
};

export default ERC20Mint;
