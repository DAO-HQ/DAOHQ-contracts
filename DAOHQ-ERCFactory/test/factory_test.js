const DAOHQERC20Factory = artifacts.require("DAOHQERC20Factory");
const Token = artifacts.require("DAOHQERC20");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("DAOHQERC20Factory", function (accounts) {
  const name = "test"
  const symbol = "tst"
  const initSupply = web3.utils.toBN(100e18);
  const fee = web3.utils.toBN(1000);
  let tokAddress;

  it("should assert true", async function () {
    await DAOHQERC20Factory.deployed();
    return assert.isTrue(true);
  });

  function BN(num){
    return web3.utils.toBN(num);
  }
  //Mint + Burn enabled
  it("should deploy token with details, collect fee", async function(){
    const factory = await DAOHQERC20Factory.deployed();

    await factory.createToken(name, symbol, initSupply, true, true, {from: accounts[1]});
    tokAddress = await factory.tokenDeployments(accounts[1], 0);

    const tok = await Token.at(tokAddress);
    const factoryBal = await tok.balanceOf(factory.address);
    const minterBal = await tok.balanceOf(accounts[1]);

    assert.equal(initSupply.toString(), BN(minterBal).toString())
    assert.equal(factoryBal.toString(), initSupply.mul(fee).div(BN(10000)).toString())
  });

  it("Deployer should be only token owner and have permission", async function(){
    const tok = await Token.at(tokAddress);
    assert.equal(await tok.owner(), accounts[1]);
    await tok.mint(accounts[2], BN(1e18), {from: accounts[1]});
    const minterBal = await tok.balanceOf(accounts[2]);
    assert.equal(BN(minterBal).toString(), BN(1e18));

    try{
      await tok.mint(accounts[3], 1e18, {from: accounts[0]});
      assert.isTrue(false);
    }catch{
      assert.isTrue(true);
    }
  });

  it("Burn should work", async function(){
    const tok = await Token.at(tokAddress);

    await tok.burn(BN(50e18), {from: accounts[1]});

    const bal = await tok.balanceOf(accounts[1]);
    assert(BN(bal).toString(), BN(50e18));

    await tok.approve(accounts[0], BN(1e18), {from: accounts[2]});

    await tok.burnFrom(accounts[2], BN(1e18));

    const bal2 = await tok.balanceOf(accounts[2]);

    assert.equal(bal2, 0);
  });

  it("Test Config of mint=true, burn=false", async function(){
    const factory = await DAOHQERC20Factory.deployed();

    await factory.createToken(name, symbol, initSupply, true, false, {from: accounts[2]});
    const tokAddr = await factory.tokenDeployments(accounts[2], 0);
    const tok = await Token.at(tokAddr);
    await tok.mint(accounts[1], BN(1e18), {from: accounts[2]});
    const minterBal = await tok.balanceOf(accounts[1]);
    assert.equal(BN(minterBal).toString(), BN(1e18));

    try{
      await tok.burn(BN(50e18), {from: accounts[2]});
      assert.isTrue(false);
    }catch{
      try{
        await tok.approve(accounts[0], BN(1e18), {from: accounts[1]});

        await tok.burnFrom(accounts[1], BN(1e18));
      }catch{
        assert.isTrue(true);
      }
    }
  });

  it("Test Config of mint=false, burn=true", async function(){
    const factory = await DAOHQERC20Factory.deployed();

    await factory.createToken(name, symbol, initSupply, false, true, {from: accounts[3]});
    const tokAddr = await factory.tokenDeployments(accounts[3], 0);
    const tok = await Token.at(tokAddr);
    try{
      await tok.mint(accounts[1], BN(1e18), {from: accounts[3]});
      assert.isTrue(false)
    }catch{
      assert.isTrue(true)
    }

    await tok.burn(BN(50e18), {from: accounts[3]});

    const bal = await tok.balanceOf(accounts[3]);
    assert(BN(bal).toString(), BN(50e18));

    await tok.transfer(accounts[2], BN(1e18), {from: accounts[3]});
    await tok.approve(accounts[0], BN(1e18), {from: accounts[2]});
    await tok.burnFrom(accounts[2], BN(1e18));

    const bal2 = await tok.balanceOf(accounts[2]);

    assert.equal(bal2, 0);
   
  });

  it("Test Config of mint=false, burn=false", async function(){
    const factory = await DAOHQERC20Factory.deployed();

    await factory.createToken(name, symbol, initSupply, false, false, {from: accounts[4]})
    const tokAddr = await factory.tokenDeployments(accounts[3], 0);
    const tok = await Token.at(tokAddr);
    try{
      await tok.mint(accounts[1], BN(1e18), {from: accounts[4]});
      assert.isTrue(false);
    }
    catch{
      try{
        await tok.burn(BN(50e18), {from: accounts[4]});
        assert.isTrue(false);
      }catch{
        try{
          await tok.transfer(accounts[2], BN(1e18), {from: accounts[4]});
          await tok.approve(accounts[0], BN(1e18), {from: accounts[2]});
          await tok.burnFrom(accounts[2], BN(1e18));
          assert.isTrue(false);
        }catch{
          assert.isTrue(true);
        }
      }
    }
  });

  it("Test Fee change + security", async function(){
    const factory = await DAOHQERC20Factory.deployed();
    const newFee = BN(5000)
    await factory.changeFee(newFee);

    await factory.createToken(name, symbol, initSupply, true, true, {from: accounts[1]});
    const tokAddr = await factory.tokenDeployments(accounts[1], 1);

    const tok = await Token.at(tokAddr);
    const factoryBal = await tok.balanceOf(factory.address);

    assert.equal(factoryBal.toString(), initSupply.mul(newFee).div(BN(10000)).toString())
    try{
      await factory.changeFee(newFee, {from: accounts[1]});
      assert.isTrue(false);
    }catch{
      assert.isTrue(true);
    }
  });

  it("Test Withdrawl of tokens", async function(){
    const users = [1, 2, 3, 4];
    const factory = await DAOHQERC20Factory.deployed();
    for(const user of users){
      const tokAddr = await factory.tokenDeployments(accounts[user], 0);
      const tok = await Token.at(tokAddr);
      const contractBal = await tok.balanceOf(factory.address);

      await factory.withdrawProceeds(tokAddr, accounts[0]);
      const contractBal1 = await tok.balanceOf(factory.address);
      const ownerBal = await tok.balanceOf(accounts[0]);
      assert.equal(contractBal1, 0);
      assert.equal(ownerBal.toString(), contractBal.toString());
    }
    try{
      const tokAddr1 = await factory.tokenDeployments(accounts[1], 1);
      const tok1 = await Token.at(tokAddr1);
      await factory.withdrawProceeds(tokAddr1, accounts[1], {from: accounts[1]})
      assert.isTrue(false);
    }catch{
      assert.isTrue(true);
    }
  });

  it("Can transfer token ownership", async function(){
    const factory = await DAOHQERC20Factory.deployed();
    const tokAddr = await factory.tokenDeployments(accounts[1], 1);

    const tok = await Token.at(tokAddr);

    await tok.transferOwnership(accounts[2], {from: accounts[1]});

    await tok.mint(accounts[1], BN(1e18), {from: accounts[2]});
    assert.isTrue(true);
  });

  it("Can transfer Factory ownership", async function(){
    const factory = await DAOHQERC20Factory.deployed();
    await factory.transferFactory(accounts[1]);

    await factory.changeFee(BN(2000), {from: accounts[1]});
    assert.isTrue(true);
  });

});
