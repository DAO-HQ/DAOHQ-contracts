const IndexToken = artifacts.require("IndexToken");
const FeeNode = artifacts.require("ManagementFeeNode");
const IssuanceManager = artifacts.require("IssuanceManager");

module.exports = async function (deployer, accounts) {
    await deployer.deploy(IssuanceManager, FeeNode.address);
    const instance = IssuanceManager.deployed();
    IndexToken.addNode(instance.address);
};