const IndexToken = artifacts.require("IndexToken");
const FeeNode = artifacts.require("ManagementFeeNode");

module.exports = async function (deployer, accounts) {
    await deployer.deploy(FeeNode, accounts[0], 5000);
    const instance = FeeNode.deployed();

    IndexToken.addNode(instance.address);
};