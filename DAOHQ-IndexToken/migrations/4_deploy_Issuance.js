const IndexToken = artifacts.require("IndexToken");
const FeeNode = artifacts.require("ManagementFeeNode");
const IssuanceManager = artifacts.require("IssuanceManager");

module.exports = async function (deployer) {
    await deployer.deploy(IssuanceManager, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    const instance = await IssuanceManager.deployed();
    const indInst = await IndexToken.deployed();
    await indInst.addNode(instance.address);
};