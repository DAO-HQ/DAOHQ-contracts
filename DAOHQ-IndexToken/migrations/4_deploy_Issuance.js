const IndexToken = artifacts.require("IndexToken");
const FeeNode = artifacts.require("ManagementFeeNode");
const IssuanceManager = artifacts.require("IssuanceManager");

module.exports = async function (deployer) {
    await deployer.deploy(IssuanceManager, FeeNode.address);
    const instance = await IssuanceManager.deployed();
    const indInst = await IndexToken.deployed();
    await indInst.addNode(instance.address);
};