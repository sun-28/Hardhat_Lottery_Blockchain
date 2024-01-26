const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper");
const { verify } = require("../utils/verify");

const chainId = network.config.chainId;
const VRF_SUB_FUND = ethers.parseEther("30");
const interval = networkConfig[chainId]['interval'];

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  let vrfCoordinatorV2Address;
  let subscriptionId;
  if (developmentChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract(
      "VRFCoordinatorV2Mock"
    );
    vrfCoordinatorV2Address = await vrfCoordinatorV2Mock.getAddress();
    const txnRes = await vrfCoordinatorV2Mock.createSubscription();
    const txnReceipt = await txnRes.wait(1);
    subscriptionId = await txnReceipt.logs[0].args.subId;
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND);
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }
  const entranceFee = networkConfig[chainId]["entranceFee"];
  const gasLane = networkConfig[chainId]["gasLane"];
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
  const args = [
    vrfCoordinatorV2Address,
    entranceFee,
    gasLane,
    subscriptionId,
    callbackGasLimit,
    interval,
  ];

  const lottery = await deploy("Lottery", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: 1,
  });

  if (developmentChains.includes(network.name)) {
    const VRFCoordinatorV2MockAtAddress = (await deployments.get("VRFCoordinatorV2Mock"))
        .address
    const VRFCoordinatorV2Mock = await ethers.getContractAt(
        "VRFCoordinatorV2Mock",
        VRFCoordinatorV2MockAtAddress,
    )
    await VRFCoordinatorV2Mock.addConsumer(subscriptionId, lottery.address)
}

  log("Lottery Deployed !");
  log("-------------------------------------");


  if(!developmentChains.includes(network.name) && process.env.ETHERSCAN_API){
      await verify(lottery.address,args)
  }


};

module.exports.tags = ["all","lottery"]
