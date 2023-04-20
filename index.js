const { ethers } = require("ethers");
const dotenv = require("dotenv");

dotenv.config();

const network = "arbitrum";
var providerUrl;
switch (network) {
    case "mainnet":
        providerUrl = process.env.MAINNET_PROVIDER_URL;
        blockExplorerUrl = "https://etherscan.io";
        break;
    case "arbitrum":
        providerUrl = process.env.ARBITRUM_PROVIDER_URL;
        blockExplorerUrl = "https://arbiscan.io";
        break;
    default:
        throw new Error(`Unsupported network: ${network}`);
}

const provider = new ethers.providers.WebSocketProvider(providerUrl);

// Replace this with the ABI for the ERC20 token you want to track
const erc20Abi = [
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  //... other ABI elements
];

const targetTokenSymbol = "FADE";

provider.on("block", async (blockNumber) => {
  console.log(`New block: ${blockNumber}`);

  try {
    const block = await provider.getBlockWithTransactions(blockNumber);

    for (const transaction of block.transactions) {
      if (transaction.to === null) {
        const contractAddress = ethers.utils.getContractAddress(transaction);
        console.log(`New contract deployed: ${contractAddress}`);

        try {
          const contract = new ethers.Contract(contractAddress, erc20Abi, provider);
          const tokenName = await contract.name();
          const tokenSymbol = await contract.symbol();

          if (tokenSymbol === targetTokenSymbol) {
            console.log(`ALERT! Found target ERC20 token "${tokenName} (${targetTokenSymbol})" at ${blockExplorerUrl}/address/${contractAddress}`);
          } else {
            console.log(`Found ERC20 token "${tokenName}" at ${blockExplorerUrl}/address/${contractAddress}`);
          }
        } catch (error) {
          console.log(`Failed to fetch token name for contract at ${contractAddress}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing block ${blockNumber}: ${error.message}`);
  }
});

process.on("SIGINT", () => {
  provider.removeAllListeners();
  process.exit(0);
});
