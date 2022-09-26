const Buffer = require('buffer');
const wh = require("@certusone/wormhole-sdk");
const Web3 = require("web3");
const axios = require('axios').default;
//Need one for each chain
const web3ETH = new Web3(new Web3.providers.WebsocketProvider("ws://127.0.0.1:7545"));
const web3Poly = new Web3(new Web3.providers.WebsocketProvider("ws://127.0.0.1:9545"));

var fs = require('fs');
//one for each chain
const hostChainIssuer = "0xfAE76dE99d9676F5BEdd6ED47bDa901f118E55C6";
const indexToken = "0x5F41b196668E8a8c49780Da87A21c71ad56d52d3";
const IssuanceNode = "0xE1B32011ed09CA392A5BDbC732a00633F522bB69";

const hostChainAbi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-IndexToken/build/contracts/HostChainIssuer.json")).abi;
const sideChainManager = "0x7016eCEdd4BDA8F78b5A0795D961B4463A94bF81";
const scToken = "0xF5a456c2D639aB41504A25DE1cD4Df0fE492Ab79";
const scIss = "0xE5cdd0a83B9e07082B4b95D82C3DcCdadDCf2c55";
const sideChainAbi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-IndexToken/build/contracts/SideChainManager.json")).abi;
const hcContract = new web3ETH.eth.Contract(hostChainAbi, hostChainIssuer);
const scContract = new web3Poly.eth.Contract(sideChainAbi, sideChainManager);

const bridges = {
    //ETH
    1: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
    137: "0x3787D11795C533807f13d14f9984E45A38D73887"
}

async function monitorHostChainIssuance(){
    hcContract.events.Deposit()
    .on('data', async function(event){
        const emitterAddress = wh.getEmitterAddressEth(bridges[2]);
        //TODO: retry
        const signedVAA = await wh.getSignedVAA(
            wh.WORMHOLE_RPC_HOST,
            2,
            emitterAddress,
            event.returnValues.seq 
        )
        await scContract.methods
        .completeBridge(Buffer.from(signedVAA.vaaBytes, "base64"))
        .send();
        console.log(event.returnedValues.seq)
    });
}

async function monitorSideChainIssuance(){
    //TODO:dynamic to sidechain ID
    scContract.events.Issued()
    .on('data', async function(event){
        await hcContract.methods
        .notifyBridgeCompletion(event.returnedValues.amtIssue, 5)
        .send();
    })
}

async function monitorHostChainRedemption(){
    hcContract.events.Withdraw()
    .on('data', async function(event){
        await scContract.methods
        .redeem(event.returnedValues.amt, event.returnedValues.chainId, "")
        .send();
    });
}

async function monitorSideChainRedemption(){
    //TODO:dynamic to sidechain ID
    scContract.events.Redemption()
    .on('data', async function(event){
        const emitterAddress = wh.getEmitterAddressEth(bridges[5]);
        //TODO:Retry logic
        const signedVAA = await wh.getSignedVAA(
            wh.WORMHOLE_RPC_HOST,
            5,
            emitterAddress,
            event.returnedValues.seq
        )
        await hcContract.methods
        .completeWithdrawl(Buffer.from(signedVAA.vaaBytes, 'base64'), event.returnedValues.to)
        .send();
    })
}

hcContract.events.Deposit({
    fromBlock: 15525312
}, function(error, event){ if(error){console.log(error);} })
.on('connected',  function(subscriptionId){
    console.log(subscriptionId);
})
.on('data', function(event){
    setTimeout(function(){
    axios.get('http://localhost:3000/api', {
        params: {
            id: event.returnValues.chainId,
            seq: event.returnValues.seq
        }
        })
        .catch(function(error){
            console.log(error);
        })
        .then(function (response) {
        console.log(response.data)
        const bytes = response.data.msg;
        web3Poly.eth.getAccounts(function(error, result){
            scContract.methods.completeBridge(bytes, scToken, scIss).send({from: result[0]}).then(console.log("funds bridged"));
        })
    })
    }, 5000)
});


scContract.events.Issued()
.on('connected',  function(subscriptionId){
    console.log(subscriptionId);
})
.on('data', function(event){
    web3ETH.eth.getAccounts(function(error, result){
        hcContract
        .methods
        .notifyBridgeCompletion(event.returnValues.amtIssue, 137, indexToken, IssuanceNode)
        .send({from: result[0]})
        .then(console.log("complete Deposit"));
    })
})

hcContract.events.Withdraw()
.on('data', async function(event){
    console.log(event.returnValues)
});
