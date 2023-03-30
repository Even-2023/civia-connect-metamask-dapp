import { connect, getStarknet } from "@argent/get-starknet"
import { CompiledContract, constants, shortString } from "starknet"

import { Network } from "./token.service"

export const silentConnectWallet = async () => {
  const windowStarknet = await connect({ showList: false })
  if (!windowStarknet?.isConnected) {
    await windowStarknet?.enable({
      showModal: false,
      starknetVersion: "v4",
    } as any)
  }
  return windowStarknet
}

export const connectWallet = async () => {
  const windowStarknet = await connect({
    include: ["civia"],
  })
  await windowStarknet?.enable({ starknetVersion: "v4" } as any)
  return windowStarknet
}

export const walletAddress = async (): Promise<string | undefined> => {
  const starknet = getStarknet()
  if (!starknet?.isConnected) {
    return
  }
  return starknet.selectedAddress
}

export const networkId = (): Network | undefined => {
  const starknet = getStarknet()
  if (!starknet?.isConnected) {
    return
  }
  try {
    const { chainId } = starknet.provider
    if (chainId === constants.StarknetChainId.MAINNET) {
      return "mainnet-alpha"
    } else if (chainId === constants.StarknetChainId.TESTNET) {
      return "goerli-alpha"
    } else if (chainId === constants.StarknetChainId.TESTNET2) 
      return "goerli2-alpha"
    else {
      return "localhost"
    }
  } catch {}
}

export const addToken = async (address: string): Promise<void> => {
  const starknet = getStarknet()
  if (!starknet?.isConnected) {
    throw Error("starknet wallet not connected")
  }
  await starknet.request({
    type: "wallet_watchAsset",
    params: {
      type: "ERC20",
      options: {
        address,
      },
    },
  })
}

export const getExplorerBaseUrl = (): string | undefined => {
  const network = networkId()
  if (network === "mainnet-alpha") {
    return "https://voyager.online"
  } else if (network === "goerli-alpha") {
    return "https://goerli.voyager.online"
  } else if (network === "goerli2-alpha") {
    return "https://goerli.voyager.online"
  }
}

export const chainId = (): string | undefined => {
  const starknet = getStarknet()
  if (!starknet?.isConnected) {
    return
  }
  try {
    return shortString.decodeShortString(starknet.provider.chainId)
  } catch {}
}

export const signMessage = async (message: string) => {
  const starknet = getStarknet()
  if (!starknet?.isConnected) throw Error("starknet wallet not connected")
  if (!shortString.isShortString(message)) {
    throw Error("message must be a short string")
  }

  return starknet.account.signMessage({
    domain: {
      name: "Example DApp",
      chainId: networkId() === "mainnet-alpha" ? "SN_MAIN" : "SN_GOERLI2",
      version: "0.0.1",
    },
    types: {
      StarkNetDomain: [
        { name: "name", type: "felt" },
        { name: "chainId", type: "felt" },
        { name: "version", type: "felt" },
      ],
      Message: [{ name: "message", type: "felt" }],
    },
    primaryType: "Message",
    message: {
      message,
    },
  })
}

export const waitForTransaction = async (hash: string) => {
  const starknet = getStarknet()
  if (!starknet?.isConnected) {
    return
  }
  return starknet.provider.waitForTransaction(hash)
}

export const addWalletChangeListener = async (
  handleEvent: (accounts: string[]) => void,
) => {
  const starknet = getStarknet()
  if (!starknet?.isConnected) {
    return
  }
  starknet.on("accountsChanged", handleEvent)
}

export const removeWalletChangeListener = async (
  handleEvent: (accounts: string[]) => void,
) => {
  const starknet = getStarknet()
  if (!starknet?.isConnected) {
    return
  }
  starknet.off("accountsChanged", handleEvent)
}

export const declare = async (contract: string, classHash: string) => {
  const starknet = getStarknet()
  if (!starknet?.isConnected) {
    throw Error("starknet wallet not connected")
  }

  return starknet.account.declare({
    contract,
    classHash,
  })
}
