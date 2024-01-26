const { network, deployments, ethers } = require("hardhat");
const { assert, expect } = require("chai");
const { developmentChains, networkConfig } = require("../../helper.js");
const { Contract } = require("ethers");

const zeroBytes = new Uint8Array();
!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery Unit Tests", function () {
      let lottery,
        lotteryContract,
        vrfCoordinatorV2Mock,
        lotteryEntranceFee,
        interval,
        player;

      beforeEach(async () => {
        accounts = await ethers.getSigners();
        player = accounts[1];
        await deployments.fixture(["mocks", "lottery"]);
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        lotteryContract = await ethers.getContract("Lottery");
        lottery = lotteryContract.connect(player);
        lotteryEntranceFee = await lottery.getEntranceFee();
        interval = Number(await lottery.getInterval());
      });

      describe("constructor", function () {
        it("initializes the lottery correctly", async () => {
          const lotteryState = (await lottery.getLotteryState()).toString();
          assert.equal(lotteryState, "0");
          assert.equal(
            interval.toString(),
            networkConfig[network.config.chainId]["interval"]
          );
        });
      });

      describe("enterLottery", function () {
        it("reverts when you don't pay enough", async () => {
          await expect(lottery.enterLottery()).to.be.revertedWithCustomError(
            lottery,
            "Lottery__NotEnoughETH"
          );
        });
        it("records player when they enter", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          const contractPlayer = await lottery.getPlayers(0);
          assert.equal(player.address, contractPlayer);
        });
        it("emits event on enter", async () => {
          await expect(
            lottery.enterLottery({ value: lotteryEntranceFee })
          ).to.emit(lottery, "LotteryEnter");
        });
        it("doesn't allow entrance when lottery is calculating", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send("evm_increaseTime", [interval + 1]);
          await network.provider.send("evm_mine", []);
          await lottery.performUpkeep(zeroBytes);
          await expect(
            lottery.enterLottery({ value: lotteryEntranceFee })
          ).to.be.revertedWithCustomError(lottery, "Lottery__NotOpen");
        });
      });
      describe("checkUpkeep", function () {
        it("returns false if people haven't sent any ETH", async () => {
          await network.provider.send("evm_increaseTime", [interval + 1]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } =
            await lottery.checkUpkeep.staticCall(zeroBytes);
          assert(!upkeepNeeded);
        });
        it("returns false if lottery isn't open", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send("evm_increaseTime", [interval + 1]);
          await network.provider.send("evm_mine", []);
          await lottery.performUpkeep(zeroBytes);
          const lotteryState = await lottery.getLotteryState();
          const { upkeepNeeded } =
            await lottery.checkUpkeep.staticCall(zeroBytes);
          assert.equal(lotteryState.toString() == "1", upkeepNeeded == false);
        });
        it("returns false if enough time hasn't passed", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send("evm_increaseTime", [interval - 5]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } =
            await lottery.checkUpkeep.staticCall(zeroBytes);
          assert(!upkeepNeeded);
        });
        it("returns true if enough time has passed, has players, eth, and is open", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send("evm_increaseTime", [interval + 1]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } =
            await lottery.checkUpkeep.staticCall(zeroBytes);
          assert(upkeepNeeded);
        });
      });

      describe("performUpkeep", function () {
        it("can only run if checkupkeep is true", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send("evm_increaseTime", [interval + 1]);
          await network.provider.send("evm_mine", []);
          const tx = await lottery.performUpkeep(zeroBytes);
          assert(tx);
        });
        it("reverts if checkup is false", async () => {
          await expect(
            lottery.performUpkeep(zeroBytes)
          ).to.be.revertedWithCustomError(lottery, "Lottery__UpkeepNotNeeded");
        });
        it("updates the lottery state and emits a requestId", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send("evm_increaseTime", [interval + 1]);
          await network.provider.send("evm_mine", []);
          const txResponse = await lottery.performUpkeep(zeroBytes);
          const txReceipt = await txResponse.wait(1);
          const requestId = txReceipt.logs[1].args.requestId;
          const lotteryState = await lottery.getLotteryState();
          assert(requestId > 0);
          assert(lotteryState == 1);
        });
      });
      describe("fulfillRandomWords", function () {
        beforeEach(async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send("evm_increaseTime", [interval + 1]);
          await network.provider.send("evm_mine", []);
        });
        it("can only be called after performupkeep", async () => {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.target)
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.target)
          ).to.be.revertedWith("nonexistent request");
        });

        it("picks a winner, resets, and sends money", async () => {
          const additionalEntrances = 3;
          const startingIndex = 2;
          let startingBalance;
          for (
            let i = startingIndex;
            i < startingIndex + additionalEntrances;
            i++
          ) {
            lottery = lotteryContract.connect(accounts[i]);

            await lottery.enterLottery({ value: lotteryEntranceFee });
          }
          const startingTimeStamp = await lottery.getTimeStamp();
          await new Promise(async (resolve, reject) => {
            lottery.on("WinnerPicked", async () => {
              console.log("WinnerPicked event fired!");
              try {
                const recentWinner = await lottery.getRecentWinner();
                const lotteryState = await lottery.getLotteryState();
                const provider = ethers.getDefaultProvider();
                const winnerBalance = await provider.getBalance(
                  accounts[2].address
                );
                const endingTimeStamp = await lottery.getTimeStamp();
                await expect(lottery.getPlayers(0)).to.be.reverted;
                assert.equal(recentWinner.toString(), accounts[2].address);
                assert.equal(lotteryState, 0);
                assert.equal(
                  winnerBalance,
                  startingBalance +
                    lotteryEntranceFee * BigInt(additionalEntrances + 1)
                );
                assert(endingTimeStamp > startingTimeStamp);
                resolve();
              } catch (e) {
                reject(e);
              }
            }); 
            try {
  const tx = await lottery.performUpkeep(zeroBytes);
              const txReceipt = await tx.wait(1);
              const provider = ethers.getDefaultProvider();
              startingBalance = await provider.getBalance(accounts[2].address);
              await vrfCoordinatorV2Mock.fulfillRandomWords(
                txReceipt.logs[1].args.requestId,
                lottery.target
              );
            } catch (e) {
              reject(e);
            }
          });
        });
      });
    });
