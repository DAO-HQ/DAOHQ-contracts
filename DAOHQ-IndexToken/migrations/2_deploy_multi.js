const HostChainIssuer = artifacts.require("HostChainIssuer");

module.exports = async function (deployer, network, accounts) {
    if(network == "eth_dev"){
        await deployer.deploy(HostChainIssuer, "noUri", "test", accounts[0], "0x26aAd2da94C59524ac0D93F6D6Cbf9071d7086f2", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
        const hcIn = await HostChainIssuer.deployed();
        const depSidechain = "0xf40349DFcCD87508Bf8263128Cdab5d94bc3dF6F"
        await hcIn.addSideChain(137, depSidechain)
    }
}