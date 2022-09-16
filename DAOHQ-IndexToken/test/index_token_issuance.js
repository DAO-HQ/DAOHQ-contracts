const IndexToken = artifacts.require("IndexToken");
const FeeNode = artifacts.require("ManagementFeeNode");
const IssuanceManager = artifacts.require("IssuanceManager");
/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("IndexToken", function (accounts) {
  
  it("should deploy", async function () {
    await IndexToken.deployed();
    await FeeNode.deployed();
    await IssuanceManager.deployed();
    return assert.isTrue(true);
  });

  function BN(value){
    return web3.utils.toBN(value);
  }

  async function getTokenAmounts(IssueInst, indexInst){ 
    let startBalances = [];
    for(let i = 0; i < 5; i++){
       startBalances.push(BN(await IssueInst.getTokenQty(indexInst.address, i)));
       //console.log(startBalances[i].toString());
     }
    return startBalances
  }

  it("should purchase 1 token to seed", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    const startPrice = web3.utils.toBN("57080000000000000");
    await IssueInst.seedNewSet(indexInst.address,
       0, accounts[2], {from:accounts[2], value: startPrice});
    const bal = web3.utils.toBN(await indexInst.balanceOf(accounts[2]))
    assert.equal(bal.toString(), web3.utils.toWei("1").toString());
  });

  it("Should purch ~ 1 new token after launch", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    const startPrice = web3.utils.toBN("57080000000000000");

    //const expectedOut = await IssueInst.getAmountOut(indexInst.address, startPrice);
    const preVal = BN(await IssueInst.getIndexValue(indexInst.address));
    const preSupply = BN(await indexInst.totalSupply());
    await IssueInst.issueForExactETH(indexInst.address, 0, accounts[3], {from: accounts[3], value: startPrice});
    const bal = BN(await indexInst.balanceOf(accounts[3]));
    const postVal = BN(await IssueInst.getIndexValue(indexInst.address));
    const expectedOut = ((preSupply.mul(postVal).div(preVal)).sub(preSupply)).div(BN(1e18)).mul(BN(1e18))
    //console.log(expectedOut.toString());
    assert.equal(expectedOut.toString(), bal.toString(), "Balance not expected");
    assert.isTrue(postVal.toString() >= preVal.add((startPrice.mul(BN(98)).div(BN(100)))).toString());
  });

  it("1 should redeem for 1/ts of all tokens", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    const sellAmount = BN(1e18);
    const startAmounts = await getTokenAmounts(IssueInst, indexInst);
    const preSupply = BN(await indexInst.totalSupply());
    await IssueInst.redeem(indexInst.address, sellAmount, accounts[3], {from: accounts[3]})
    const endAmounts = await getTokenAmounts(IssueInst, indexInst);

    for(let i = 0; i < 5; i++){
      let expectedAmt = startAmounts[i].sub(startAmounts[i].mul(sellAmount).div(preSupply));
      assert.equal(endAmounts[i].toString(), expectedAmt.toString());
    }
   });

   it("Should redeem for expected value", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    const startPrice = web3.utils.toBN("57080000000000000");
    await IssueInst.issueForExactETH(indexInst.address, 0, accounts[3], {from: accounts[3], value: startPrice});
    const preVal1 = BN(await IssueInst.getIndexValue(indexInst.address));
    const preBal = BN(await web3.eth.getBalance(accounts[2]));
    const preSupp1 = BN(await indexInst.totalSupply());
    const sellAmnt1 = BN(1e18);
    const receipt = await IssueInst.redeem(indexInst.address, sellAmnt1, accounts[2], {from: accounts[2]})
    
    //const postVal1 = BN(await IssueInst.getIndexValue(indexInst.address));
    const postBal = BN(await web3.eth.getBalance(accounts[2]));
    const balanceGain1 = postBal.sub(preBal).add(BN(receipt.receipt.gasUsed).mul(BN(2000000000)));
    const expected1 = preVal1.sub(preVal1.mul(sellAmnt1).div(preSupp1));
    console.log(balanceGain1.toString());
    console.log(expected1.toString());
    assert.isTrue(balanceGain1 >= expected1);
  });
});
