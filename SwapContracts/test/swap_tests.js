const DAOHqSwap = artifacts.require("DAOHqSwap");
var fs = require('fs');
/*
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 * requires an ETH Mainnet Ganache fork as Dev URL
 * Rout calculation mirrors functions used on frontend. Currently executing transactions at Market Price(ie no minAmountOut)
 */

// Change on other systems
var erc20abi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts-local/build/contracts/IERC20.json")).abi;
var factoryabi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts-local/node_modules/@uniswap/v2-core/build/IUniswapV2Factory.json")).abi;
var pairabi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts-local/node_modules/@uniswap/v2-core/build/IUniswapV2Pair.json")).abi;
//Uniswap + SushiSwap
const factories = ["0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f", "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac"]

function toBN(bal){
  return web3.utils.toBN(web3.utils.toHex(bal.toLocaleString('fullwide', {useGrouping:false})))
}

async function getERC20Bal(token, address, approve, approveAddr){
  var token = new web3.eth.Contract(erc20abi, token)
 
  let bal = await token.methods.balanceOf(address).call()
  //console.log(bal)
  if(approve){
      token.methods.approve(approveAddr, toBN(bal)).send({from: address})
  }
  return bal
}

async function calculateRoute(token, fromWETH){
  let pool;
  for (const amm of factories) {
    const fact = new web3.eth.Contract(factoryabi, amm);
    pool = await fact.methods.getPair("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", token).call();
    if (pool !== "0x0000000000000000000000000000000000000000") {
      break
    }
  }
  
  if (pool === "0x0000000000000000000000000000000000000000") {
    console.log("No pool")
    throw Error
  }

  const tokPair = new web3.eth.Contract(pairabi, pool);
  const tok1 = await tokPair.methods.token1().call();
  
  let prefix;
  if (fromWETH) {
    prefix = tok1.toLowerCase() === token.toLocaleLowerCase() ? "0x00" : "0x80";
  } else {
    prefix = tok1.toLowerCase() === token.toLocaleLowerCase() ? "0xc0" : "0x40";
  }
  return `${[prefix]}000000000000003b6d0340${pool.substring(2)}`
}

// calculate multi hop swaps with W(Native) as connector
async function calculateTokenSwapRoute(fromToken, toToken) {
  let path = [];
  const fromToWeth = await calculateRoute(fromToken, false)
  path.push(fromToWeth);
  const wethTo2 = await calculateRoute(toToken, true);
  path.push(wethTo2);
  return path;
}

contract("DAOHqSwap", function (accounts) {

  it("Contract Deploys", async function () {
    await DAOHqSwap.deployed();
    return assert.isTrue(true);
  });

  it("Should purchase Token and collect Fee", async function(){
    const instance = await DAOHqSwap.deployed()
    const toTokenAddress = "0x1A4b46696b2bB4794Eb3D4c26f1c55F9170fa4C5"; //BitDao Token Addr
    const route = await calculateRoute(toTokenAddress, true);

    const initWalletBal = await web3.eth.getBalance(accounts[5]);
    const initContractBal = await web3.eth.getBalance(instance.address);
    const initTokenBal = await getERC20Bal(toTokenAddress, accounts[5], false);

    let amountReturned = await instance.swapExactETHForTokens(
      "0x0000000000000000000000000000000000000000", 0, 0, [route],
      {value: toBN(1e17), from: accounts[5]})
    
    const finWalletBal = await web3.eth.getBalance(accounts[5]);
    const finContractBal = await web3.eth.getBalance(instance.address);
    const finTokenBal = await getERC20Bal(toTokenAddress, accounts[5], false);
    const fee = .025;

    //assert.isTrue(amountReturned > 0, "Tokens not returned")
    assert.isTrue(finTokenBal - initTokenBal > 0, "Token Balance incorrect")
    assert.equal(1e17 * fee, finContractBal - initContractBal, "Fee not collected")
    assert.isTrue(finWalletBal < initWalletBal, "ETH not spent")
  });

  it("Can Swap Tokens and Collect Fee in From Token", async function(){
    const instance = await DAOHqSwap.deployed();
    // BitDao -> ZRX
    const fromAddress = "0x1A4b46696b2bB4794Eb3D4c26f1c55F9170fa4C5"; //BitDao
    const toAddress = "0xE41d2489571d322189246DaFA5ebDe1F4699F498"; // ZRX
    const route = await calculateTokenSwapRoute(fromAddress, toAddress);

    const initFromBal = await getERC20Bal(fromAddress, accounts[5], true, instance.address);
    const initToBal = await getERC20Bal(toAddress, accounts[5], false);
    const initConBal = await getERC20Bal(fromAddress, instance.address, false);

    await instance.swapExactTokensForTokens(fromAddress, initFromBal, 0, route, 
      {from: accounts[5]});

    const finFromBal = await getERC20Bal(fromAddress, accounts[5], false);
    const finToBal = await getERC20Bal(toAddress, accounts[5], false);
    const finConBal = await getERC20Bal(fromAddress, instance.address, false);   
    
    assert.equal(finFromBal, 0, "Did not swap all tokens");
    assert.equal(initFromBal * .025, finConBal - initConBal, "fee not collected");
    assert.isTrue(finToBal - initToBal > 0, "Did not receive tokens");
  });

  it("Should Sell Token and Collect Fee", async function (){

    const instance = await DAOHqSwap.deployed()
    const fromTokenAddress = "0xE41d2489571d322189246DaFA5ebDe1F4699F498"; // ZRX
    const route = await calculateRoute(fromTokenAddress, false);
       
    const initWalletBal = await web3.eth.getBalance(accounts[5]);
    const initContractBal = await web3.eth.getBalance(instance.address);
    // Approve in this step
    const initTokenBal = await getERC20Bal(fromTokenAddress, accounts[5], true, instance.address);
    assert.isTrue(initTokenBal > 0, "Should Have ERC20 Bal")

    let amountReturned = await instance.swapExactTokensForETH(fromTokenAddress,
      toBN(initTokenBal), 0, [route], {from: accounts[5]});

    const finWalletBal = await web3.eth.getBalance(accounts[5]);
    const finContractBal = await web3.eth.getBalance(instance.address);
    const finTokenBal = await getERC20Bal(fromTokenAddress, accounts[5], false);
    const fee = .025;

    //assert.isTrue(amountReturned > 0, "ETH not returned");
    assert.equal(finTokenBal, 0, "Should have spend all tokens");
    assert.isTrue(finContractBal - initContractBal > 0, "Fee not collected")
    assert.isTrue(finWalletBal > initWalletBal, "ETH not received");  
  });
  /*
  Tests Route Hash calculation for swapping to tokens whose pair token0 is the end of the route
  */
  it("Should Calc Route & Swap to Token for pair.token0 = toToken(0x80)", async function(){
    
    const instance = await DAOHqSwap.deployed()
    const toTokenAddress = "0x111111111117dc0aa78b770fa6a738034120c302"; //1inch 
    const route = await calculateRoute(toTokenAddress, true);
    assert.equal("0x80", route.slice(0, 4), "route prefix not calculated correctly")
    const initWalletBal = await web3.eth.getBalance(accounts[5]);
    const initContractBal = await web3.eth.getBalance(instance.address);
    const initTokenBal = await getERC20Bal(toTokenAddress, accounts[5], false);

    let amountReturned = await instance.swapExactETHForTokens(
      "0x0000000000000000000000000000000000000000", 0, 0, [route],
      {value: toBN(1e17), from: accounts[5]})
    
    const finWalletBal = await web3.eth.getBalance(accounts[5]);
    const finContractBal = await web3.eth.getBalance(instance.address);
    const finTokenBal = await getERC20Bal(toTokenAddress, accounts[5], false);
    const fee = .025;

    //assert.isTrue(amountReturned > 0, "Tokens not returned")
    assert.isTrue(finTokenBal - initTokenBal > 0, "Token Balance incorrect")
    assert.isTrue(finContractBal - initContractBal > 0, "Fee not collected")
    assert.isTrue(finWalletBal < initWalletBal, "ETH not spent")
  });

  /*
  Tests Route Hash calculation for swapping from tokens whose pair token0 is the start of the route
  */
  it("Should Calc Route & Sell to ETH for pair.token0 = fromToken(0x40)", async function (){

    const instance = await DAOHqSwap.deployed()
    const fromTokenAddress = "0x111111111117dc0aa78b770fa6a738034120c302"; //1inch 
    const route = await calculateRoute(fromTokenAddress, false);
    assert.equal("0x40", route.slice(0, 4), "route prefix not calculated correctly")
    const initWalletBal = await web3.eth.getBalance(accounts[5]);
    const initContractBal = await web3.eth.getBalance(instance.address);
    // Approve in this step
    const initTokenBal = await getERC20Bal(fromTokenAddress, accounts[5], true, instance.address);
    assert.isTrue(initTokenBal > 0, "Should Have ERC20 Bal")

    let amountReturned = await instance.swapExactTokensForETH(fromTokenAddress,
      toBN(initTokenBal), 0, [route], {from: accounts[5]});

    const finWalletBal = await web3.eth.getBalance(accounts[5]);
    const finContractBal = await web3.eth.getBalance(instance.address);
    const finTokenBal = await getERC20Bal(fromTokenAddress, accounts[5], false);
    const fee = .025;

    //assert.isTrue(amountReturned > 0, "ETH not returned");
    assert.equal(finTokenBal, 0, "Should have spend all tokens");
    assert.isTrue(finContractBal - initContractBal > 0, "Fee not collected")
    assert.isTrue(finWalletBal > initWalletBal, "ETH not received");  
  });

  it("Should Calc Route & Swap to Token for pair.token1 = toToken(0x00)", async function(){
    
    const instance = await DAOHqSwap.deployed()
    const toTokenAddress = "0xE41d2489571d322189246DaFA5ebDe1F4699F498"; // ZRX
    const route = await calculateRoute(toTokenAddress, true);
    assert.equal("0x00", route.slice(0, 4), "route prefix not calculated correctly")
    const initWalletBal = await web3.eth.getBalance(accounts[5]);
    const initContractBal = await web3.eth.getBalance(instance.address);
    const initTokenBal = await getERC20Bal(toTokenAddress, accounts[5], false);

    let amountReturned = await instance.swapExactETHForTokens(
      "0x0000000000000000000000000000000000000000", 0, 0, [route],
      {value: toBN(1e17), from: accounts[5]})
    
    const finWalletBal = await web3.eth.getBalance(accounts[5]);
    const finContractBal = await web3.eth.getBalance(instance.address);
    const finTokenBal = await getERC20Bal(toTokenAddress, accounts[5], false);
    const fee = .025;

    //assert.isTrue(amountReturned > 0, "Tokens not returned")
    assert.isTrue(finTokenBal - initTokenBal > 0, "Token Balance incorrect")
    assert.equal(1e17 * fee, finContractBal - initContractBal, "Fee not collected")
    assert.isTrue(finWalletBal < initWalletBal, "ETH not spent")
  });

  it("Should Calc Route & Swap to Token for pair.token1 = toToken(0xc0)", async function (){

    const instance = await DAOHqSwap.deployed()
    const fromTokenAddress = "0xE41d2489571d322189246DaFA5ebDe1F4699F498"; // ZRX
    const route = await calculateRoute(fromTokenAddress, false);
    assert.equal("0xc0", route.slice(0, 4), "route prefix not calculated correctly")
    const initWalletBal = await web3.eth.getBalance(accounts[5]);
    const initContractBal = await web3.eth.getBalance(instance.address);
    // Approve in this step
    const initTokenBal = await getERC20Bal(fromTokenAddress, accounts[5], true, instance.address);
    assert.isTrue(initTokenBal > 0, "Should Have ERC20 Bal")

    let amountReturned = await instance.swapExactTokensForETH(fromTokenAddress,
      toBN(initTokenBal), 0, [route], {from: accounts[5]});

    const finWalletBal = await web3.eth.getBalance(accounts[5]);
    const finContractBal = await web3.eth.getBalance(instance.address);
    const finTokenBal = await getERC20Bal(fromTokenAddress, accounts[5], false);
    const fee = .025;

    //assert.isTrue(amountReturned > 0, "ETH not returned");
    assert.equal(finTokenBal, 0, "Should have spend all tokens");
    assert.isTrue(finContractBal - initContractBal > 0, "Fee not collected")
    assert.isTrue(finWalletBal > initWalletBal, "ETH not received");  
  });

  it("Incorrect route/prefix should fail", async function(){
    const instance = DAOHqSwap.deployed;
    const toTokenAddress = "0x111111111117dc0aa78b770fa6a738034120c302"; //1inch 
    const route = await calculateRoute(toTokenAddress, true);
    try{
      await instance.swapExactETHForTokens(
        "0x0000000000000000000000000000000000000000", 0, 0, [route.replace("0x80", "0x00")],
        {value: toBN(1e17), from: accounts[5]});
      assert(false)
    }catch(error){
      assert(error)
    }
  });

  it("Should change fee", async function(){
    const instance = await DAOHqSwap.deployed();
    await instance.setFees(350, {from: accounts[0]})
    const newFee = await instance.fees()

    assert.equal(newFee, 350)
  });

  it("Non-owner Should be Blocked from Withdraw", async function(){
    const instance = await DAOHqSwap.deployed();
    try{
      await instance.withdrawFees(balance, accounts[4], {from: accounts[4]});
      assert(false)
    }catch(error){
      assert(error)
    }
  });

  it("Should Withdraw Tokens", async function (){
    const instance = await DAOHqSwap.deployed();
    const balance = await web3.eth.getBalance(instance.address);
    const initWalletBal = await web3.eth.getBalance(accounts[0]);

    await instance.withdrawFees(balance, accounts[0], {from: accounts[0]});

    const finbalance = await web3.eth.getBalance(instance.address);
    const finWalletBal = await web3.eth.getBalance(accounts[0]);

    assert.equal(finbalance, 0, "ETH didnt leave contract");
    assert.isTrue(finWalletBal > initWalletBal);
  });

  it("Should Withdraw ERC20 Tokens", async function (){
    const instance = await DAOHqSwap.deployed();
    const fromAddress = "0x1A4b46696b2bB4794Eb3D4c26f1c55F9170fa4C5"; //BitDao

    const initConTokenBal = await getERC20Bal(fromAddress, instance.address, false);
    const initWalletBal = await getERC20Bal(fromAddress, accounts[0], false );

    await instance.withdrawERCFees(fromAddress, accounts[0], {from: accounts[0]});

    const finConTokenBal = await getERC20Bal(fromAddress, instance.address, false);
    const finWalletBal = await getERC20Bal(fromAddress, accounts[0], false);
    
    assert.equal(finConTokenBal, 0, "Contract bal not emptied")
    assert.isTrue(finWalletBal > initWalletBal, "Fee not received")
  });

});
