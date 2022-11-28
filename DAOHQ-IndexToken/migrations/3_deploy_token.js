const IndexToken = artifacts.require("IndexToken");
const HostChainIssuer = artifacts.require("HostChainIssuerV1");

module.exports = async function (deployer, network, accounts) {
    /*const tokens = ["0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", "0x1A4b46696b2bB4794Eb3D4c26f1c55F9170fa4C5", "0x4d224452801ACEd8B2F0aebE155379bb5D594381",
                    "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32", "0x0F5D2fB29fb7d3CFeE444a200298f468908cC942", "0x853d955aCEf822Db058eb8505911ED77F175b99e",
                    "0x111111111117dC0aa78b770fA6A738034120C302", "0x476c5E26a75bd202a9683ffD34359C0CC15be0fF","0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F",
                    "0xc00e94Cb662C3520282E6f5717214004A7f26888"]*/
    
    let pools;
    let shares;
    let external;
    if(network == "eth_dev"){
          pools = ["0xd3d2E2692501A5c9Ca623199D38826e513033a17", "0xE12af1218b4e9272e9628D7c7Dc6354D137D024e", "0x1bEC4db6c3Bc499F3DbF289F5499C30d541FEc97", "0xC558F600B34A5f69dD2f0D06Cb8A88d829B7420a"];
          //pools = ["0xd3d2E2692501A5c9Ca623199D38826e513033a17", "0xE12af1218b4e9272e9628D7c7Dc6354D137D024e", "0xb011EEaab8bF0c6DE75510128dA95498E4b7e67F",
          //              "0x454F11D58E27858926d7a4ECE8bfEA2c33E97B13", /* "0x11b1f53204d03E5529F09EB3091939e4Fd8c9CF3", /*"0xFD0A40Bc83C5faE4203DEc7e5929B446b07d1C76",
          //              "0x26aAd2da94C59524ac0D93F6D6Cbf9071d7086f2", "0xCc3d1EceF1F9fD25599dbeA2755019DC09db3c54", "0x43AE24960e5534731Fc831386c07755A2dc33D47",
          //              "0xCFfDdeD873554F362Ac02f8Fb1f02E5ada10516f", "0x05767d9EF41dC40689678fFca0608878fb3dE906", "0xA70d458A4d9Bc0e6571565faee18a48dA5c0D593"*/]
          shares = [1000, 1000, 1000, 1000, 4000, /*1000/* 1000, 1000, 1000, 1000, 1000, 1000, 1000*/];
          const hcInst = await HostChainIssuer.deployed();
          external = [web3.eth.abi.encodeParameters(['address', 'uint256'], [hcInst.address, 137])];
          //external = []
     }else if(network == "live_eth"){
          pools = ["0xd3d2E2692501A5c9Ca623199D38826e513033a17",
          "0xC40D16476380e4037e6b1A2594cAF6a6cc8Da967",
          "0xb011EEaab8bF0c6DE75510128dA95498E4b7e67F",
          "0xD75EA151a61d06868E31F8988D28DFE5E9df57B4",
          "0x1bEC4db6c3Bc499F3DbF289F5499C30d541FEc97",
          "0xC2aDdA861F89bBB333c90c492cB837741916A225",
          "0xE12af1218b4e9272e9628D7c7Dc6354D137D024e",
          "0x43AE24960e5534731Fc831386c07755A2dc33D47",
          "0xC558F600B34A5f69dD2f0D06Cb8A88d829B7420a",
          "0x3dA1313aE46132A397D90d95B1424A9A7e3e0fCE",
          "0x26aAd2da94C59524ac0D93F6D6Cbf9071d7086f2",
          "0x05767d9EF41dC40689678fFca0608878fb3dE906",
          "0x31503dcb60119A812feE820bb7042752019F2355",
          "0xa1181481bEb2dc5De0DaF2c85392d81C704BF75D",
          "0xA70d458A4d9Bc0e6571565faee18a48dA5c0D593",
          "0x088ee5007C98a9677165D78dD2109AE4a3D04d0C",
          "0x3e8468f66d30Fc99F745481d4B383f89861702C6",
          "0xc03C6f5d6C5Bf2959a4E74e10fD916b5B50BF102",
          "0x755C1a8F71f4210CD7B60b9439451EfCbeBa33D1",
          "0x001b6450083E531A5a7Bf310BD2c1Af4247E23D4",
          "0xc6F348dd3B91a56D117ec0071C1e9b83C0996De4",
          "0x795065dCc9f64b5614C407a6EFDC400DA6221FB0",
          "0xC730EF0f4973DA9cC0aB8Ab291890D3e77f58F79",
          "0x6AdA49AECCF6E556Bb7a35ef0119Cc8ca795294A",
          "0x611CDe65deA90918c0078ac0400A72B0D25B9bb1"]
          shares = [26300,
               21100,
               7500,
               5100,
               4600,
               4100,
               3800,
               3300,
               2300,
               2100,
               2100,
               1800,
               1800,
               1600,
               1600,
               1500,
               1300,
               1200,
               1200,
               1100,
               1100,
               1000,
               900,
               900,
               700]
          external = []
     }
     else{
         pools = ["0xE7C714DD3dD70eE04EB69A856655765454E77c88", "0x9A8b2601760814019B7E6eE0052E25f1C623D1E6", "0xf69e93771F11AECd8E554aA165C3Fe7fd811530c", "0x597A9bc3b24C2A578CCb3aa2c2C62C39427c6a49"]
         shares = [1000, 1000, 1000, 1000]
         external = [];
    }

    await deployer.deploy(IndexToken,
         "TestIndex",
         "TIDX",
         accounts[0], 
         web3.utils.toBN("83300000000000000"),//web3.utils.toBN("57080000000000000"),
         pools,
         external,
         shares);
};