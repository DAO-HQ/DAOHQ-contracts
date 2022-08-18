const Web3 = require('web3');
var fs = require('fs');
var axios = require('axios');
const HDWalletProvider = require('truffle-hdwallet-provider');
const file  = "build/contracts/IDAOHQERC20.json"
var abi = JSON.parse(fs.readFileSync(file));
var factoryAbi = JSON.parse(fs.readFileSync("build/contracts/DAOHQERC20Factory.json")).abi;
var source = fs.readFileSync("contracts/FlatERC.sol").toString();

const web3 = new Web3(new HDWalletProvider('', 
'https://rpc-sepolia.rockx.com'));

const factory = new web3.eth.Contract(factoryAbi, "0xef00b08E486e3b40A640b306Cae4dDB843Bf258e");

async function editABI(){
    const isMint = false;
    const isBurn = false;
    const name = "HQ Token2"
    const sym = "DHQT2"
    const vault = await web3.eth.getAccounts();
    const initSupp = web3.utils.toWei("10000");
    const cap = 0;
    
    //const address = await factory.methods.createToken(name, sym, vault[0], initSupp, cap, isMint, isBurn).send({from: vault[0]})
    const address = "0x3b3c4Fce5e84A73B263eF4d589A1065dA552f168"
    if(!isMint){
    abi.abi.splice(abi.abi.findIndex(x => x.name === "mint"), 1);
    abi.ast.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "updateMintAuthority"), 1);
    abi.ast.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "mint"), 1);
    abi.legacyAST.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "updateMintAuthority"), 1);
    abi.legacyAST.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "mint"), 1);
    }
    if(!isBurn){
        abi.abi.splice(abi.abi.findIndex(x => x.name === "burn"), 1); 
        abi.abi.splice(abi.abi.findIndex(x => x.name === "burnFrom"), 1);
        abi.ast.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "burn"), 1);
        abi.ast.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "burnFrom"), 1);
        abi.legacyAST.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "burn"), 1);
        abi.legacyAST.nodes[2].nodes.splice(abi.ast.nodes[2].nodes.findIndex(x => x.name === "burnFrom"), 1);
    }

    fs.writeFile("UpdatedAbi.json", JSON.stringify(abi, null, 4), (err) => {
        if (err) throw err;
        console.log('Data written to file');
    });
    const fee = 1000 //await factory.methods.fee().call();

    const construtor = web3.eth.abi.encodeParameters(
        ['string', 'string', 'uint256', 'uint256', 'uint256', 'address', 'bool', 'bool'],
        [name, sym, initSupp, fee, cap, vault[0], isMint, isBurn]);
    
    // Verify source on etherscan
    const verificationData = new URLSearchParams({apikey:'MRZDW63HMKB9VDMNF93YSA2NNYAGXF25BA',        
        module: 'Contract',
        action: 'verifysourcecode',
        contractaddress: address,
        sourceCode: source,
        contractName: "DAOHQERC20",
        codeformat: 'solidity-single-file',
        compilerversion: 'v0.8.12+commit.f00d7308',
        optimizationUsed: 0, 
        runs: 200,
        constructorArguements: construtor.substring(2),
        licenseType: 3
    }).toString()
    let headers;
    try{
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
          }
        /*const result = await axios.post("https://api-sepolia.etherscan.io/api", verificationData, {headers: headers});
        console.log(result.data.result);*/
    }catch(error){
        console.log(error);
    }

    console.log(await axios.post("https://api-sepolia.etherscan.io/api", new URLSearchParams({apikey: 'MRZDW63HMKB9VDMNF93YSA2NNYAGXF25BA',
        guid: "qk4antrtakb8pqrqptqcvkfk5kmjmfr486n4zy3jjx4cshnrzp", module: 'contract', action: 'checkverifystatus'}), {headers, headers}));

}

editABI()