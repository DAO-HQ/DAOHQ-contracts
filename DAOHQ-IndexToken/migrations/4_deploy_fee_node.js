const IndexToken = artifacts.require("IndexToken");
const FeeNode = artifacts.require("ManagementFeeNode");

module.exports = async function (deployer, network, accounts) {
    await deployer.deploy(FeeNode, accounts[0], 5000);
    const instance = await FeeNode.deployed();
    const indInst = await IndexToken.deployed();
    await indInst.addNode(instance.address);
};