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

  it("should purchase 1 token and underlying assets", async function(){
    const IssueInst = await IssuanceManager.deployed();
    const indexInst = await IndexToken.deployed();
    const startPrice = web3.utils.toBN("57080000000000000");
    await IssueInst.issueForExactETH(indexInst.address,
       0, accounts[2], {from:accounts[2], value: startPrice, gasLimit: 5000000});
    const bal = web3.utils.toBN(await indexInst.balanceOf(accounts[2]))
    assert.equal(bal.toString(), web3.utils.toWei("1").toString());

  });
});
