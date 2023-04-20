const fs = require('fs');
const { ethers } = require('ethers');
const dotenv = require("dotenv");

dotenv.config();


const network = "mainnet";
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

// Uniswap V2 Factory contract ABI
const factoryAbi = [
    // PairCreated event from the Uniswap V2 Factory contract
    "event PairCreated(address indexed token0, address indexed token1, address pair, uint)"
];

// Uniswap V2 Factory contract address
const uniswapV2FactoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";


let monitoredContracts = [];


// Monitor liquidity deployment
async function monitorLiquidity() {
    // Create a contract instance for the Uniswap V2 Factory
    const factory = new ethers.Contract(uniswapV2FactoryAddress, factoryAbi, provider);
    let safeContracts = [];
    try {
        safeContracts = JSON.parse(fs.readFileSync('safeContracts.json'));
    } catch (err) {
        console.error(`Error: No safeContracts.json found.`);
        return;
    }
    for (let i = 0; i < safeContracts.length; i++) {

        // Target token address
        const targetTokenAddress = safeContracts[i];; // Replace with your target token's contract address

        if (monitoredContracts.includes(targetTokenAddress)) {
            continue;
        }

        // Listen for the PairCreated event
        factory.on("PairCreated", (token0, token1, pair, event) => {
            // Check if the target token is involved in the liquidity event
            if (token0.toLowerCase() === targetTokenAddress.toLowerCase() || token1.toLowerCase() === targetTokenAddress.toLowerCase()) {
            console.log(`New liquidity pair involving the target token detected!`);
            console.log(`Token0: ${token0}`);
            console.log(`Token1: ${token1}`);
            console.log(`Pair Address: ${pair}`);
            }
        });

        console.log(`Monitoring for liquidity deployment of token: ${targetTokenAddress}`);
    }    
}

monitorLiquidity();
setInterval(monitorLiquidity, 10000);