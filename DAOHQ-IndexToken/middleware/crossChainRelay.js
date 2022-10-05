const Web3 = require("web3");
const express = require('express');
const axios = require('axios').default;
const app = express()
const port = 3005

//Need one for each chain
const web3ETH = new Web3(new Web3.providers.WebsocketProvider("ws://127.0.0.1:7545"));
const web3Poly = new Web3(new Web3.providers.WebsocketProvider("ws://127.0.0.1:9545"));

var fs = require('fs');
//one for each chain
let hostChainIssuer = "0x1C0dCC05050f54aCef9B708868cECa8D7471bAA2";
let indexToken = "0x1F27D0c3f7554Eca5C79d988E2B077183bDF87b7";
let IssuanceNode = "0xcc2C47A129Db44C6791C1caA8C5313887a31467A";

const hostChainAbi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-IndexToken/build/contracts/HostChainIssuer.json")).abi;
const sideChainManager = "0x3E3BC8e8A102597A4Ce688732d9067EBE39E7D67";
const scToken = "0x06bdC7F05f0C029e016358984E0E2d58f4dCe4c4";
const scIss = "0x311Bc1aFed07B8540573A412159e520C6A36694b";
const sideChainAbi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-IndexToken/build/contracts/SideChainManager.json")).abi;
const ITokenabi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-IndexToken/build/contracts/IToken.json")).abi;
const IssueAbi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-IndexToken/build/contracts/IssuanceManager.json")).abi;
let hcContract = new web3ETH.eth.Contract(hostChainAbi, hostChainIssuer);
let scContract = new web3Poly.eth.Contract(sideChainAbi, sideChainManager);

const bridges = {
    //ETH
    1: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
    137: "0x0Aa3174De081C9A93CEA8805B7B792cF26aE3a15"
}

const contracts = {
    137: {
        Issue: new web3Poly.eth.Contract(IssueAbi, scIss),
        token: new web3Poly.eth.Contract(ITokenabi, scToken)
    }
}

function fixSignature (signature) {
    // in geth its always 27/28, in ganache its 0/1. Change to 27/28 to prevent
    // signature malleability if version is 0/1
    // see https://github.com/ethereum/go-ethereum/blob/v1.8.23/internal/ethapi/api.go#L465
    let v = parseInt(signature.slice(130, 132), 16);
    if (v < 27) {
      v += 27;
    }
    const vHex = v.toString(16);
    return signature.slice(0, 130) + vHex;
  }
//console.log(fixSignature("0x0d01f9e8835513495d29d3f67c927c794de2a940791395ee20a6b20cf2041c733a5371fc13babf70f4e8d44ef9de50ce35f6436f53002efc2c3b2651e33a29b401"))

app.get('/setValue', (req, res) => {
    const chainId = req.query.id;
    contracts[chainId].Issue
    .methods
    .getIndexValue(scToken, [], [])
    .call()
    .then(function(value){
        contracts[chainId].token.methods
        .totalSupply().call()
        .then(function(totalSupply){
            const ppt = web3ETH.utils.toBN(value)
            .mul(web3ETH.utils.toBN(1e5))
            .div(web3ETH.utils.toBN(totalSupply))
            web3ETH.eth.getAccounts(function(error, result){
                const hash = web3ETH.utils.soliditySha3(ppt).toString("hex")
                web3ETH.eth.sign(hash, result[0])
                .then(function(signature){
                    res.send({sig: fixSignature(signature), data: ppt.toString()})
                });
            })
        })
    })
})

app.get('/setAddresses', (req, res) => {
    const addrs = req.query;
    hostChainIssuer = addrs.hc;
    IssuanceNode = addrs.is;
    indexToken = addrs.in;
    subscribeListeners();
    res.send("OK");
})

app.listen(port)
console.log('Server started at http://localhost:' + port);

function subscribeListeners() {
    hcContract = new web3ETH.eth.Contract(hostChainAbi, hostChainIssuer);
    console.log(hcContract.address);
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
            console.log(error);
            console.log(event.returnValues);
            scContract
            .methods
            .redeem(event.returnValues.amt, 1, event.returnValues.toUser, event.returnValues.hostContract, scToken, scIss)
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
                    .send({from: result[0], gasLimit: 5000000})
                    .then(console.log("funds bridged and paid"));
                })
            })
            }, 5000)
    })
}


// prod version 
// listen for deposit
// on deposit execute web3.contract(WETH instance(sc)).once('Transfer', {filter:{to: scAddr, from: HyphenLPAddr}})
// call completeBidge in SideChain manager contract

//