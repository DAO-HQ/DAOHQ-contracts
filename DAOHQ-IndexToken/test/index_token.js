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
  /*
  it("Total supply should be accurate(inad: test mint function)", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    const startPrice = web3.utils.toBN("83300000000000000");
    await IssueInst.seedNewSet(indexInst.address,
       0, accounts[2], {from:accounts[2], value: startPrice});
    const bal = web3.utils.toBN(await indexInst.balanceOf(accounts[2]));

    const ts = BN(await indexInst.totalSupply());

    assert.equal(bal.toString(), ts.toString());
  });
  */
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
    //const creationIndex = ["0xd3d2E2692501A5c9Ca623199D38826e513033a17", "0xE12af1218b4e9272e9628D7c7Dc6354D137D024e", "0xb011EEaab8bF0c6DE75510128dA95498E4b7e67F",
    //"0x454F11D58E27858926d7a4ECE8bfEA2c33E97B13", "0x11b1f53204d03E5529F09EB3091939e4Fd8c9CF3"]
    //const shares = [1000, 1000, 1000, 1000, 1000];
    const creationIndex = ["0xd3d2E2692501A5c9Ca623199D38826e513033a17",
          "0xC40D16476380e4037e6b1A2594cAF6a6cc8Da967",
          "0xb011EEaab8bF0c6DE75510128dA95498E4b7e67F",
          "0xD75EA151a61d06868E31F8988D28DFE5E9df57B4",
          "0x1bEC4db6c3Bc499F3DbF289F5499C30d541FEc97",
          "0xC2aDdA861F89bBB333c90c492cB837741916A225",
          "0xE12af1218b4e9272e9628D7c7Dc6354D137D024e",
          "0x43AE24960e5534731Fc831386c07755A2dc33D47",
          "0xC558F600B34A5f69dD2f0D06Cb8A88d829B7420a",
          "0x3dA1313aE46132A397D90d95B1424A9A7e3e0fCE",
          "0x26aAd2da94C59524ac0D93F6D6Cbf9071d7086f2",
          "0x05767d9EF41dC40689678fFca0608878fb3dE906",
          "0x31503dcb60119A812feE820bb7042752019F2355",
          "0x3dA1313aE46132A397D90d95B1424A9A7e3e0fCE",
          "0xA70d458A4d9Bc0e6571565faee18a48dA5c0D593",
          "0x088ee5007C98a9677165D78dD2109AE4a3D04d0C",
          "0x3e8468f66d30Fc99F745481d4B383f89861702C6",
          "0xc03C6f5d6C5Bf2959a4E74e10fD916b5B50BF102",
          "0x755C1a8F71f4210CD7B60b9439451EfCbeBa33D1",
          "0x001b6450083E531A5a7Bf310BD2c1Af4247E23D4",
          "0xc6F348dd3B91a56D117ec0071C1e9b83C0996De4",
          "0x795065dCc9f64b5614C407a6EFDC400DA6221FB0",
          "0xC730EF0f4973DA9cC0aB8Ab291890D3e77f58F79",
          "0x6AdA49AECCF6E556Bb7a35ef0119Cc8ca795294A",
          "0x611CDe65deA90918c0078ac0400A72B0D25B9bb1"]
          const shares = [26300,
               21100,
               7500,
               5100,
               4600,
               4100,
               3800,
               3300,
               2300,
               2100,
               2100,
               1800,
               1800,
               1600,
               1600,
               1500,
               1300,
               1200,
               1200,
               1100,
               1100,
               1000,
               900,
               900,
               700]
    const components = await indexInst.getComponents()
    let cumulativeShare = 0;
    for(let i = 0; i < 25; i ++){
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
    assert.equal(components[6], newComponent)
    let cumulativeShare = 0;
    for(let i = 0; i < 25; i ++){
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
      await IssueInst.issueForExactETH(indexInst.address, 0, accounts[3], [], "", {from: accounts[3], value: BN(1e18)});
      assert.isTrue(false);
    }catch{
      assert.isTrue(true);
    }

  });

  it("Should add node and have permissions", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    const startPrice = web3.utils.toBN("83300000000000000");
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
