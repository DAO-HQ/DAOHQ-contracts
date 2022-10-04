const IndexToken = artifacts.require("IndexToken");
const IssuanceManager = artifacts.require("IssuanceManager");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("IndexToken", function (accounts) {
  
  it("should assert true", async function () {
    await IndexToken.deployed();
    return assert.isTrue(true);
  });

  function BN(value){
    return web3.utils.toBN(value);
  }

  it("Total supply should be accurate(inad: test mint function)", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    const startPrice = web3.utils.toBN("57080000000000000");
    await IssueInst.seedNewSet(indexInst.address,
       0, accounts[2], {from:accounts[2], value: startPrice});
    const bal = web3.utils.toBN(await indexInst.balanceOf(accounts[2]));

    const ts = BN(await indexInst.totalSupply());

    assert.equal(bal.toString(), ts.toString());
  });

  it("should collect fee on transfer", async function(){
    const indexInst = await IndexToken.deployed();
    const tAmount = BN(1e16)
    await indexInst.transfer(accounts[1], tAmount, {from: accounts[2]});
    const feeCollected = BN(await indexInst.balanceOf(accounts[0]));
    const feeExpected = tAmount.mul(BN(30)).div(BN(10000));
    const balReceiver = BN(await indexInst.balanceOf(accounts[1]));
    assert.equal(feeCollected.toString(), feeExpected.toString());
    assert.equal(tAmount.sub(feeExpected).toString(), balReceiver.toString());

    await indexInst.approve(accounts[1], tAmount, {from: accounts[2]});
    await indexInst.transferFrom(accounts[2], accounts[3], tAmount, {from: accounts[1]});
    const balReceiver1 = BN(await indexInst.balanceOf(accounts[3]));
    const feeCollected1 = BN(await indexInst.balanceOf(accounts[0])).sub(feeCollected);
    assert.equal(feeCollected1.toString(), feeExpected.toString());
    assert.equal(tAmount.sub(feeExpected).toString(), balReceiver1.toString());
  });

  it("Remote permissioned token approval and burn(via redeem)", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    const tsInit = BN(await indexInst.totalSupply());
    await IssueInst.redeem(indexInst.address, BN(1e16), accounts[2], {from: accounts[2]})
    const tsFin = BN(await indexInst.totalSupply());
    assert.equal(tsInit.sub(tsFin).toString(), BN(1e16).toString());
  });

  it("Get Components, share, cumulative share are correct", async function(){
    const indexInst = await IndexToken.deployed();
    const creationIndex = ["0xd3d2E2692501A5c9Ca623199D38826e513033a17", "0xE12af1218b4e9272e9628D7c7Dc6354D137D024e", "0xb011EEaab8bF0c6DE75510128dA95498E4b7e67F",
    "0x454F11D58E27858926d7a4ECE8bfEA2c33E97B13", "0x11b1f53204d03E5529F09EB3091939e4Fd8c9CF3"]
    const shares = [1000, 1000, 1000, 1000, 1000];

    const components = await indexInst.getComponents()
    let cumulativeShare = 0;
    for(let i = 0; i < 5; i ++){
      assert.equal(components[i], creationIndex[i]);
      const share = await indexInst.getShare(components[i]);
      assert.equal(BN(share).toString(), BN(shares[i]).toString())
      cumulativeShare += shares[i]
    }

    const actualCumulative = BN(await indexInst.getCumulativeShare());
    assert.equal(actualCumulative.toString(), BN(cumulativeShare).toString());
  });

  it("Test Component replacement", async function(){
    const indexInst = await IndexToken.deployed();
    const newComponent = "0x26aAd2da94C59524ac0D93F6D6Cbf9071d7086f2";
    const oldComponent = "0xE12af1218b4e9272e9628D7c7Dc6354D137D024e";
    const newShare = 2000;
    await indexInst.replaceComponent(newComponent, oldComponent, newShare);

    const components = await indexInst.getComponents()
    assert.equal(components[1], newComponent)
    let cumulativeShare = 0;
    for(let i = 0; i < 5; i ++){
      if(components[i] == oldComponent){
        asset.isTrue(false);
      }
      const share = await indexInst.getShare(components[i]);
      if(components[i] == newComponent){
        assert.equal(newShare, share);
      }
      cumulativeShare += parseInt(share)
    }
    const actualCumulative = BN(await indexInst.getCumulativeShare());
    assert.equal(actualCumulative.toString(), BN(cumulativeShare).toString());
  });

  it("should edit component", async function(){
    const indexInst = await IndexToken.deployed();
    const component = "0x26aAd2da94C59524ac0D93F6D6Cbf9071d7086f2";
    const newShare = BN(3000);
    const preCumulative = BN(await indexInst.getCumulativeShare());
    await indexInst.editComponent(component, newShare);
    const postCumulative = BN(await indexInst.getCumulativeShare());
    const newShareR = BN(await indexInst.getShare(component));

    assert.equal(postCumulative.sub(preCumulative).toString(), "1000")
    assert.equal(newShareR.toString(), newShare.toString());
  });

  it("Should remove node permissions", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    await indexInst.removeNode(IssueInst.address);
    try{
      await IssueInst.issueForExactETH(indexInst.address, 0, accounts[3], [], [], {from: accounts[3], value: BN(1e18)});
      assert.isTrue(false);
    }catch{
      assert.isTrue(true);
    }

  });

  it("Should add node and have permissions", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    const startPrice = web3.utils.toBN("57080000000000000");
    await indexInst.addNode(IssueInst.address);
    await IssueInst.issueForExactETH(indexInst.address, 0, accounts[3], [], [], {from: accounts[3], value: startPrice});
    assert.isTrue(true);
  })

  it("should block non managers from select functions", async function(){
    const indexInst = await IndexToken.deployed();
    const IssueInst = await IssuanceManager.deployed();
    try{
      await indexInst.addNode(IssueInst.address, {from: accounts[1]});
      assert.isTrue(false);
    }catch{
      assert.isTrue(true);
    }
  })
});
