const IndexToken = artifacts.require("IndexToken");
const FeeNode = artifacts.require("ManagementFeeNode");

module.exports = async function (deployer, network, accounts) {
    const indInst = await IndexToken.deployed();
    await deployer.deploy(FeeNode, accounts[0], 5000, indInst.address);
    const instance = await FeeNode.deployed();
    await indInst.addNode(instance.address);
};