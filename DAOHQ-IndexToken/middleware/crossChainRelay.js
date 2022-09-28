const Buffer = require('buffer');
const wh = require("@certusone/wormhole-sdk");
const Web3 = require("web3");
const axios = require('axios').default;
//Need one for each chain
const web3ETH = new Web3(new Web3.providers.WebsocketProvider("ws://127.0.0.1:7545"));
const web3Poly = new Web3(new Web3.providers.WebsocketProvider("ws://127.0.0.1:9545"));

var fs = require('fs');
//one for each chain
const hostChainIssuer = "0xDC863BA2308F953a6AA815F2C6aBD6c7112b4a8F";
const indexToken = "0x70A1003781987a373faf37A95B322BFFfE30AC37";
const IssuanceNode = "0xaAC480E41d53435E7A638660C08115B3B69fa92d";

const hostChainAbi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-IndexToken/build/contracts/HostChainIssuer.json")).abi;
const sideChainManager = "0x30F377d8566593941a99566d3E6fac3B1c90E71a";
const scToken = "0xd2497a2f64640D94E17Ea1577940672DEcEAF55e";
const scIss = "0x9a60BbedBEE78f19660B225c227817e4c1e35333";
const sideChainAbi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-IndexToken/build/contracts/SideChainManager.json")).abi;
const hcContract = new web3ETH.eth.Contract(hostChainAbi, hostChainIssuer);
const scContract = new web3Poly.eth.Contract(sideChainAbi, sideChainManager);

const bridges = {
    //ETH
    1: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
    137: "0x0Aa3174De081C9A93CEA8805B7B792cF26aE3a15"
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

//Issuance flow
hcContract.events.Deposit({
    fromBlock: 'latest'
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
        //console.log(response.data)
        const bytes = response.data.msg;
        web3Poly.eth.getAccounts(function(error, result){
            scContract.methods.completeBridge(bytes, scToken, scIss).send({from: result[0], gasLimit: 4000000}).then(console.log("funds bridged"));
        })
    })
    }, 5000)
});


scContract.events.Issued()
.on('connected',  function(subscriptionId){
    console.log(subscriptionId);
})
.on('data', function(event){
    console.log(event.returnValues);
    web3ETH.eth.getAccounts(function(error, result){
        hcContract
        .methods
        .notifyBridgeCompletion(event.returnValues.amtIssue, 137, indexToken, IssuanceNode)
        .send({from: result[0]})
        .then(console.log("complete Deposit"));
    })
})

hcContract.events.Withdraw()
.on('connected',  function(subscriptionId){
    console.log(subscriptionId);
})
.on('data', function(event){
    console.log(event.returnValues);
    web3Poly.eth.getAccounts(function(error, result){
        scContract
        .methods
        .redeem(event.returnValues.amt, 1, event.returnValues.toUser, scToken, scIss)
        .send({from: result[0], gasLimit: 4000000})
        .then(console.log("Funds withdrawn and bridged"));
    })
});

scContract.events.Redemption()
.on('connected',  function(subscriptionId){
    console.log(subscriptionId);
})
.on('data', function(event){
    console.log(event.returnValues);
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
            //console.log(response.data)
            const bytes = response.data.msg;
            web3ETH.eth.getAccounts(function(error, result){
                hcContract
                .methods
                .completeWithdrawl(bytes, event.returnValues.to)
                .send({from: result[0]})
                .then(console.log("funds bridged and paid"));
            })
        })
        }, 5000)
})
