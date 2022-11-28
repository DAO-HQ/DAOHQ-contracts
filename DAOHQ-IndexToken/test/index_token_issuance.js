const IndexToken = artifacts.require("IndexToken");
const FeeNode = artifacts.require("ManagementFeeNode");
const IssuanceManager = artifacts.require("IssuanceManager");
/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("IssuanceManagerNode", function (accounts) {
  
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
    for(let i = 0; i < 25; i++){
       startBalances.push(BN(await IssueInst.getTokenQty(indexInst.address, i)));
       //console.log(startBalances[i].toString());
     }
    return startBalances
  }
  /*
  it("should purchase 1 token to seed", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    const startPrice = web3.utils.toBN("83300000000000000");
    await IssueInst.seedNewSet(indexInst.address,
       0, accounts[2], {from:accounts[2], value: startPrice});
    const bal = web3.utils.toBN(await indexInst.balanceOf(accounts[2]))
    assert.equal(bal.toString(), web3.utils.toWei("1").toString());
  });
  */
  it("Seed Should be blocked after first purchase", async function(){
    try{
      const IssueInst = await IssuanceManager.deployed();
      const indexInst = await IndexToken.deployed();
      const startPrice = web3.utils.toBN("83300000000000000");
      await IssueInst.seedNewSet(indexInst.address,
         0, accounts[2], {from:accounts[2], value: startPrice});
      assert.isTrue(false);
    }catch{
      assert.isTrue(true);
    }
  });

  it("Should purch ~ 1 new token after launch", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    const startPrice = web3.utils.toBN("83300000000000000");

    //const expectedOut = await IssueInst.getAmountOut(indexInst.address, startPrice);
    const preVal = BN(await IssueInst.getIndexValue(indexInst.address, [], []));
    const preSupply = BN(await indexInst.totalSupply());
    await IssueInst.issueForExactETH(indexInst.address, 0, accounts[3], [], [], {from: accounts[3], value: startPrice});
    const bal = BN(await indexInst.balanceOf(accounts[3]));
    const postVal = BN(await IssueInst.getIndexValue(indexInst.address, [], []));
    const expectedOut = ((preSupply.mul(postVal).div(preVal)).sub(preSupply)).div(BN(1e18)).mul(BN(1e18))
    //console.log(expectedOut.toString());
    assert.equal(expectedOut.toString(), bal.toString(), "Balance not expected");
    assert.isTrue(postVal.toString() >= preVal.add((startPrice.mul(BN(98)).div(BN(100)))).toString());
  });

  it("Should revert if min Qty isnt met", async function(){
    try{
      const IssueInst = await IssuanceManager.deployed();
      const indexInst = await IndexToken.deployed();
      const startPrice = web3.utils.toBN("83300000000000000");
      await IssueInst.issueForExactETH(indexInst.address, BN(1e20), accounts[3], [], [],{from: accounts[3], value: startPrice});
      assert.isTrue(false);
    }catch{
      assert.isTrue(true);
    }
  });

  it("1 should redeem for 1/ts of all tokens", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    const sellAmount = BN(1e18);
    const startAmounts = await getTokenAmounts(IssueInst, indexInst);
    const preSupply = BN(await indexInst.totalSupply());
    await IssueInst.redeem(indexInst.address, sellAmount, accounts[3], {from: accounts[3]})
    const endAmounts = await getTokenAmounts(IssueInst, indexInst);
    for(let i = 0; i < 25; i++){
      let expectedAmt = startAmounts[i].sub(startAmounts[i].mul(sellAmount).div(preSupply));
      assert.equal(endAmounts[i].toString(), expectedAmt.toString());
    }
   });

   function normalize(number, digits){
    return number.div(BN(digits)).mul(BN(digits));
   }

   it("Should redeem for expected value", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    const startPrice = web3.utils.toBN("83300000000000000");
    await IssueInst.issueForExactETH(indexInst.address, 0, accounts[3], [], [], {from: accounts[3], value: startPrice});
    const preVal1 = BN(await IssueInst.getIndexValue(indexInst.address, [], []));
    const preBal = BN(await web3.eth.getBalance(accounts[2]));
    const preSupp1 = BN(await indexInst.totalSupply());
    const sellAmnt1 = BN(1e18);
    let receipt = await IssueInst.redeem(indexInst.address, sellAmnt1, accounts[2], {from: accounts[2]})
    
    //const postVal1 = BN(await IssueInst.getIndexValue(indexInst.address));
    const postBal = BN(await web3.eth.getBalance(accounts[2]));
    const balanceGain1 = postBal.sub(preBal).add(BN(receipt.receipt.gasUsed).mul(BN(20000000000)));
    //console.log(preVal1.toString(), preSupp1.toString());
    const expected1 = preVal1.mul(sellAmnt1).div(preSupp1);
    //console.log(balanceGain1.toString());
    //console.log(expected1.toString());
    assert.equal(normalize(balanceGain1,1e15).toString(), normalize(expected1,1e15).toString());

    const preVal2 = BN(await IssueInst.getIndexValue(indexInst.address, [], []));
    const preBal2 = BN(await web3.eth.getBalance(accounts[3]));
    const preSupp2 = BN(await indexInst.totalSupply());
    const sellAmnt2 = BN(9e17);
    receipt = await IssueInst.redeem(indexInst.address, sellAmnt2, accounts[3], {from: accounts[3]})
    
    //const postVal1 = BN(await IssueInst.getIndexValue(indexInst.address));
    const postBal2 = BN(await web3.eth.getBalance(accounts[3]));
    const balanceGain2 = postBal2.add(BN(receipt.receipt.gasUsed).mul(BN(20000000000))).sub(preBal2);
    //console.log(preVal2.toString(), preSupp2.toString());
    const expected2 = preVal2.mul(sellAmnt2).div(preSupp2);
    //console.log(balanceGain2.toString());
    //console.log(expected2.toString());
    assert.equal(normalize(balanceGain2, 1e15).toString(), normalize(expected2, 1e15).toString());
  });

  it("Should replace component and rebalance fund", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();

    const newComponent = "0x26aAd2da94C59524ac0D93F6D6Cbf9071d7086f2";
    const oldComponent = "0x6AdA49AECCF6E556Bb7a35ef0119Cc8ca795294A";
    const preBal = BN(await IssueInst.getTokenQty(indexInst.address, 23))
    const preVal = BN(await IssueInst.getIndexValue(indexInst.address, [], []));
    await indexInst.replaceComponent(newComponent, oldComponent, 1000);

    const preBalNew = BN(await IssueInst.getTokenQty(indexInst.address, 23));
    //assert.equal(preBalNew.toString(), "0", "Token not replaced");

    await IssueInst.rebalanceExitedFunds(indexInst.address, [oldComponent], [23]);
    const postBalNew = BN(await IssueInst.getTokenQty(indexInst.address, 23));
    const postVal = BN(await IssueInst.getIndexValue(indexInst.address, [], []));
    //console.log(preVal.toString(), postVal.toString());
    assert.isTrue(postBalNew > BN(0));
  });

  it("Should support multi-component replacement", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();

    const oldComponent = [
      "0xd3d2E2692501A5c9Ca623199D38826e513033a17",
      "0xC40D16476380e4037e6b1A2594cAF6a6cc8Da967"
    ]

    const newComponent = [
      "0xCFfDdeD873554F362Ac02f8Fb1f02E5ada10516f",
      "0x05767d9EF41dC40689678fFca0608878fb3dE906"
      ]
    const preVal = BN(await IssueInst.getIndexValue(indexInst.address, [], []));
    await indexInst.replaceComponent(newComponent[0], oldComponent[0], 25000);
    await indexInst.replaceComponent(newComponent[1], oldComponent[1], 20000);
    const postBal0 = BN(await IssueInst.getTokenQty(indexInst.address, 0));
    const postBal1 = BN(await IssueInst.getTokenQty(indexInst.address, 1));
    //assert.equal(postBal0.add(postBal1).toString(), "0");

    await IssueInst.rebalanceExitedFunds(indexInst.address, oldComponent, [0,1]);
    
    const postBalNew0 = BN(await IssueInst.getTokenQty(indexInst.address, 0));
    const postBalNew1 = BN(await IssueInst.getTokenQty(indexInst.address, 1));
    const postVal = BN(await IssueInst.getIndexValue(indexInst.address, [], []));
    //console.log(preVal.toString(), postVal.toString());
    assert.isTrue(postBalNew0 > BN(0));
    assert.isTrue(postBalNew1 > BN(0));
  });

});
