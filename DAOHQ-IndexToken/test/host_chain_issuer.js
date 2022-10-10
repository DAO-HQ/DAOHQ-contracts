const axios = require('axios').default;
const Web3 = require("web3");
var fs = require('fs');
const HostChainIssuer = artifacts.require("HostChainIssuer");
const IndexToken = artifacts.require("IndexToken");
const FeeNode = artifacts.require("ManagementFeeNode");
const IssuanceManager = artifacts.require("IssuanceManager");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("HostChainIssuer", function (accounts) {
  const web3Poly = new Web3(new Web3.providers.WebsocketProvider("ws://127.0.0.1:9545"));
  //Update before test
  const sideChainManager = "0xf40349DFcCD87508Bf8263128Cdab5d94bc3dF6F";
  const scToken = "0x48ec47a583A4C0e064cc87C20553c2d694Eeb0eD";
  const scIss = "0xF8F8f91f797885dE79bC5BF7dd898e8a08021973";
  //const sideChainAbi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-IndexToken/build/contracts/SideChainManager.json")).abi;
  const ITokenabi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-IndexToken/build/contracts/IToken.json")).abi;
  const IssueAbi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-IndexToken/build/contracts/IssuanceManager.json")).abi;
  const sidechainIssue = new web3Poly.eth.Contract(IssueAbi, scIss);
  const scTokenContract = new web3Poly.eth.Contract(ITokenabi, scToken);

  function BN(value){
    return web3.utils.toBN(value);
  }

  function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function getExternalValue(){
    const res = await axios.get('http://localhost:3005/setValue', {
      params: {
          ids: 137 
      }
      })
    return res.data;
  }

  it("should assert true - set up ", async function () {
    const hcIn = await HostChainIssuer.deployed();
    const inIn = await IndexToken.deployed();
    const isIn = await IssuanceManager.deployed();

    await inIn.addEditExternalPosition(web3.eth.abi.encodeParameters(['address', 'uint256'], [hcIn.address, 137]), 1000)

    const res = await axios.get('http://localhost:3005/setAddresses', { 
     params: {
      hc: hcIn.address,
      is: isIn.address,
      in: inIn.address
    }});
    console.log(isIn.address);
    return assert.isTrue(true);
  });

  it("should purchase assets on both chains", async function(){
    const inIn = await IndexToken.deployed();
    const isIn = await IssuanceManager.deployed();
    const hcIn = await HostChainIssuer.deployed();
    const startPrice = web3.utils.toBN("57080000000000000");
    const extValData = await getExternalValue()
    await isIn.seedNewSet(inIn.address, 100000, accounts[2],
      /*[extValData.data], [extValData.sig],*/ {from: accounts[2], value: startPrice, gasLimit: 5000000});
    await timeout(8000);
    
    const res = await isIn.getIndexValue(inIn.address, extValData.data, extValData.sig)
    const delt = startPrice.sub(BN(res))
    assert.isTrue(delt.lt(BN("10000000000000000")));
    const nftBal = await hcIn.balanceOf(inIn.address, 137)
    assert.isTrue(BN(nftBal) > BN(0));
  });

  it("value representation on side chain upon issuance", async function(){
    const inIn = await IndexToken.deployed();
    const isIn = await IssuanceManager.deployed();
    const hcIn = await HostChainIssuer.deployed();
    const startPrice = web3.utils.toBN("57080000000000000");
    const preNft = await hcIn.balanceOf(inIn.address, 137);
    const preSideTok = await scTokenContract.methods.balanceOf(sideChainManager).call();
    const extValData = await getExternalValue()
    await isIn.issueForExactETH(
      inIn.address, 10000, accounts[3], extValData.data, extValData.sig,
       {from: accounts[3], value: startPrice});
    await timeout(8000);
    const postNft = await hcIn.balanceOf(inIn.address, 137);
    const postSideTok = await scTokenContract.methods.balanceOf(sideChainManager).call();

    assert.equal(BN(postNft).sub(BN(preNft)).toString(), BN(postSideTok).sub(BN(preSideTok)).toString());
  });

  it("Redemption should succeed with correct funds returned", async function(){
    const inIn = await IndexToken.deployed();
    const isIn = await IssuanceManager.deployed();
    const hcIn = await HostChainIssuer.deployed();

    const preNft = await hcIn.balanceOf(inIn.address, 137);
    const preSideTok = await scTokenContract.methods.balanceOf(sideChainManager).call();
    const preETHVal = await web3.eth.getBalance(accounts[2]);
    const ts = await inIn.totalSupply();

    let receipt = await isIn.redeem(inIn.address, BN(1e18), accounts[2], {from: accounts[2]});
    
    await timeout(10000)

    const postNft = await hcIn.balanceOf(inIn.address, 137);
    const postSideTok = await scTokenContract.methods.balanceOf(sideChainManager).call();
    const postETHVal = await web3.eth.getBalance(accounts[2]);
    const balDelta = BN(postETHVal).add(BN(receipt.receipt.gasUsed)).sub(BN(preETHVal));
    //console.log(balDelta.toString());
    assert.isTrue(balDelta.gt(BN("55000000000000000")));
    assert.equal(BN(preNft).sub(BN(postNft)).toString(), BN(preSideTok).sub(BN(postSideTok)).toString())
    assert.equal(BN(preNft).sub(BN(postNft)).toString(), BN(preNft).mul(BN(1e18)).div(BN(ts)).toString());
  })

  it("Can't forge external value sigs", async function(){
    function fixSignature (signature) {
      let v = parseInt(signature.slice(130, 132), 16);
      if (v < 27) {
        v += 27;
      }
      const vHex = v.toString(16);
      return signature.slice(0, 130) + vHex;
    }
    const inIn = await IndexToken.deployed();
    const isIn = await IssuanceManager.deployed();
    const startPrice = web3.utils.toBN("57080000000000000");
    const fakeData = [1000]
    const fakeSig = fixSignature(
      await web3.eth.sign(web3.utils.soliditySha3({t: "uint256[]", v: fakeData}).toString("hex"), accounts[3]));
    
    try{
      await isIn.issueForExactETH(
        inIn.address, 10000, accounts[3], [fakeData], fakeSig,
         {from: accounts[3], value: startPrice});
      assert.isTrue(false);
    }catch{
      assert.isTrue(true);
    }
  });

});
