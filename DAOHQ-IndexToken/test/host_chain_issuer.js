const axios = require('axios').default;
const Web3 = require("web3");
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
  const sideChainManager = "0x7eaffC4E712a4ae1eE291caee8517d7F7eAe2694";
  const scToken = "0x4C65c6bfd8Ae3c9A1087a1d9cBd2290AC0c53d89";
  const scIss = "0xB5A631616B77ECC62e9A3681A2655b89C9e3bFdf";
  //const sideChainAbi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-IndexToken/build/contracts/SideChainManager.json")).abi;
  //const ITokenabi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-IndexToken/build/contracts/IToken.json")).abi;
  const IssueAbi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-IndexToken/build/contracts/IssuanceManager.json")).abi;
  const sidechainIssue = new web3Poly.eth.Contract(IssueAbi, scIss);

  function BN(value){
    return web3.utils.toBN(value);
  }

  async function getExternalValue(){
    const res = await axios.get('http://localhost:3005/setValue', {
      params: {
          id: 137 
      }
      })
    return res.data;
  }

  it("should assert true - set up ", async function () {
    const hcIn = await HostChainIssuer.deployed();
    const inIn = await IndexToken.deployed();
    const isIn = await IssuanceManager.deployed();

    await inIn.addEditExternalPosition(
      [web3.eth.abi.encodeParameters(['address', 'uint16'], [hcIn.address, 137])],
      [1000])

    const res = await axios.post('http://localhost:3005/setAddresses',
     {
      hc: hcIn.address,
      is: isIn.address,
      in: inIn.address
    });

    return assert.isTrue(true);
  });

  it("should purchase assets on both chains", async function(){
    const inIn = await IndexToken.deployed();
    const isIn = await IssuanceManager.deployed();
    const startPrice = web3.utils.toBN("57080000000000000");
    const extValData = await getExternalValue()
    await isIn.issueForExactETH(inIn.address, 100000, accounts[2],
      extValData.data, extValData.sig, {from: accounts[2]});
      setTimeout(function(){
        const val = inIn.getIndexValue(inIn.address, extValData.data, extValData.sig)
        .then(function(res){
          const delt = startPrice.sub(BN(res))
          assert.isTrue(delt.lt(BN("10000000000000000")));
          hcIn.balanceOf(inIn.address, 137)
          .then(function(res){
            assert.isTrue(BN(res) > BN(0));
          })
        })
      }, 10000)
  })
});
