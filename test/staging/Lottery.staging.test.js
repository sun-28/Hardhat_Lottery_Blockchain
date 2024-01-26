const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
require("@nomicfoundation/hardhat-chai-matchers")
const { formatEther } = require("ethers")
const { developmentChains } = require("../../helper")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Staging Tests", function () {
          let lottery, lotteryEntranceFee, deployer
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              const lotteryAddress = (await deployments.get("Lottery")).address
              lottery = await ethers.getContractAt("Lottery", lotteryAddress)
              lotteryEntranceFee = await lottery.getEntranceFee()
              console.log("Lottery address " + lottery.target)
              console.log("Lottery entrance fees " + lotteryEntranceFee)
          })
          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
                  
                  console.log("Setting up test...")
                  const startingTimeStamp = await lottery.getTimeStamp()
                  const accounts = await ethers.getSigners()
                  const provider = ethers.getDefaultProvider()

                  console.log("Setting up Listener...")
                  await new Promise(async (resolve, reject) => {
                    //   setTimeout(resolve, 5000)
                      lottery.on("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!")
                          try {
                              
                              const recentWinner = await lottery.getRecentWinner()
                              const lotteryState = await lottery.getLotteryState()
                              const winnerEndingBalance = await provider.getBalance(
                                  accounts[0].address,
                              ) 
                              const endingTimeStamp = await lottery.getTimeStamp()

                              await expect(lottery.getPlayers(0)).to.be.reverted 
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert.equal(lotteryState, 0) 
                              assert.equal(
                                  Number(winnerEndingBalance),
                                  Number(winnerStartingBalance) + formatEther(lotteryEntranceFee),
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (error) {
                              console.log(error)
                              reject(error)
                          }
                      })
                      
                      console.log("Entering Lottery...")
                      const tx = await lottery.enterLottery({ value: lotteryEntranceFee })
                      await tx.wait(3)
                      console.log("Ok, time to wait...")
                      const winnerStartingBalance = await provider.getBalance(accounts[0].address)
                      console.log("Get here after balance ...")
                  })
              })
          })
      })

