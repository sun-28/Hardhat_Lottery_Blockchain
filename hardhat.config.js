require("@nomiclabs/hardhat-ethers")
require('@nomicfoundation/hardhat-toolbox')
require("hardhat-deploy");
require("dotenv").config();


const SEPOLIA_RPC_URL =
    process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY"

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x"

const ETHERSCAN_API = process.env.ETHERSCAN_API;


/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  etherscan: {
    apiKey: {
        sepolia: [ETHERSCAN_API],
    },
},
  networks: {
    hardhat: {
      chainId: 31337,
      blockConfirmations: 1,
    },
    localhost: {
      chainId: 31337,
      blockConfirmations: 1,
    },
    sepolia: {
      chainId: 11155111,
      blockConfirmations: 6,
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
    },
  },
  solidity: "0.8.19",
  namedAccounts: {
    deployer: {
      default: 0,
    },
    player: {
      default: 1,
    },
  },
  mocha: {
    setTimeout: 400000,
    timeout: 400000,
},
};
