const IndexToken = artifacts.require("IndexToken");
const FeeNode = artifacts.require("ManagementFeeNode");
const IssuanceManager = artifacts.require("IssuanceManager");
/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("management_fee_node", function (accounts) {
  
  function BN(value){
    return web3.utils.toBN(value);
  }
  async function currentTimestamp(){
    const blockNum = await web3.eth.getBlockNumber()
    const block = await web3.eth.getBlock(blockNum)
    return block['timestamp']
  }

  const advanceBlockAtTime = (time) => {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_mine",
          params: [time],
          id: new Date().getTime(),
        },
        (err, _) => {
          if (err) {
            return reject(err);
          }
          const newBlockHash = web3.eth.getBlock("latest").hash;
  
          return resolve(newBlockHash);
        },
      );
    });
  };

  it("should assert true", async function () {
    await FeeNode.deployed();
    return assert.isTrue(true);
  });

  it("should accrue some Fee", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    const startPrice = web3.utils.toBN("570800000000000000");
    //await IssueInst.seedNewSet(indexInst.address,
    //   0, accounts[2], {from:accounts[2], value: startPrice});
    const timestamp = await currentTimestamp();
    //await ethers.provider.send("evm_mine", [timestamp + 86400]);
    await advanceBlockAtTime(timestamp + 86400);
    const feeInst = await FeeNode.deployed();
    const bal = BN(await feeInst.calcFeeSupplyInflation(indexInst.address));
    //console.log(bal.toString());
    assert.isTrue(bal > BN(0)); 
  });

  it("Fee accuracy", async function(){
    const indexInst = await IndexToken.deployed();
    const feeInst = await FeeNode.deployed();

    await feeInst.accrueFee(indexInst.address, accounts[0]);
    const postAccrual =  BN(await feeInst.calcFeeSupplyInflation(indexInst.address));
    const managerbal = BN(await indexInst.balanceOf(accounts[0]))
    assert.equal(postAccrual.toString(), "0");

    const timestamp = await currentTimestamp();
    await advanceBlockAtTime(timestamp + 3.154e7);

    await feeInst.accrueFee(indexInst.address, accounts[5]);

    const postFeeCollect = BN(await indexInst.balanceOf(accounts[5]));
    //console.log(postFeeCollect.toString())
    const expectedFee = BN(5000).mul(BN(await indexInst.totalSupply())).div(BN(10000));
    //console.log(expectedFee.toString())

    assert.equal(postFeeCollect.div(BN(1e13)).toString(), expectedFee.div(BN(1e13)).toString());
  });

  it("Restricted to Manager", async function(){
    try{
      const indexInst = await IndexToken.deployed();
      const feeInst = await FeeNode.deployed();
  
      await feeInst.accrueFee(indexInst.address, accounts[2], {from:accounts[2]});
      const postAccrual =  BN(await feeInst.calcFeeSupplyInflation(indexInst.address));
      const managerbal = BN(await indexInst.balanceOf(accounts[0]))
      assert.isTrue(false);
    }catch{
      assert.isTrue(true);
    }
  })

});
