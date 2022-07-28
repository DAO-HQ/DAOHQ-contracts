const DAOHQotc = artifacts.require("DAOHQotc");
const token = artifacts.require("TestToken");
/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("DAOHQotc", function (/* accounts */) {
  const order_id1 = 1235;
  const order_id2 = 4321;

  it("Contract is Deployed", async function () {
    await DAOHQotc.deployed();
    await token.deployed();
    return assert.isTrue(true);
  });

  //ERC20 sell tests
  it("Should submit ERC20 Order", async function (){
    const con = await DAOHQotc.deployed();
    const tok = await token.deployed();
    const accounts = await web3.eth.getAccounts()
    const init_bal = web3.utils.toBN(await tok.balanceOf(accounts[0]))

    const amount = web3.utils.toWei("5", 'ether');

    const price = web3.utils.toWei("1", 'ether');

    await tok.approve(con.address, amount);

    await con.initiateOrder(
      tok.address,
      amount,
      price,
      3600, //1hr
      order_id1,
      false
      )
    const final_bal = web3.utils.toBN(await tok.balanceOf(accounts[0]));
    const con_bal = web3.utils.toBN(await tok.balanceOf(con.address));
    const con_report_bal = web3.utils.toBN(await con.getBalance(accounts[0], tok.address));
    assert.equal(con_bal.toString(), con_report_bal.toString());
    assert.equal(init_bal-final_bal, amount);
  });

  it("Details of ERC20 order should be correct", async function(){
    const con = await DAOHQotc.deployed();
    const tok = await token.deployed();
    const accounts = await web3.eth.getAccounts()
    const res = await con.viewOrder(order_id1);
    
    const amount = web3.utils.toWei("5", 'ether');

    const price = web3.utils.toWei("1", 'ether');

    assert.equal(res[0], amount);
    assert.equal(res[1], price);
    assert.equal(res[2], tok.address);
    assert.equal(res[4], accounts[0]);
    assert.isTrue(!res[5]);
    assert.isTrue(!res[6]);
  });

  it("Order should fulfill for ETH", async function(){
    const con = await DAOHQotc.deployed();
    const tok = await token.deployed();
    const accounts = await web3.eth.getAccounts()
    const init_bal = web3.utils.toBN(await tok.balanceOf(accounts[1]));
    const init_con_bal = web3.utils.toBN(await tok.balanceOf(con.address));
    const init_eth_bal1 = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));
    const init_eth_bal2 = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));

    const price = web3.utils.toWei("1", 'ether');
    const amount = web3.utils.toWei("5", 'ether');

    await con.fulfillOrder(order_id1, {from: accounts[1], value: price});

    const fin_bal = web3.utils.toBN(await tok.balanceOf(accounts[1]));
    const fin_con_bal = web3.utils.toBN(await tok.balanceOf(con.address));
    const fin_eth_bal1 = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));
    const fin_eth_bal2 = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));

    const con_user_report_bal = web3.utils.toBN(await con.getBalance(accounts[0], tok.address));

    assert.equal(init_con_bal - fin_con_bal, amount);
    assert.equal(fin_bal - init_bal, amount);
    assert.equal(fin_eth_bal2 - init_eth_bal2, price);
    assert.isTrue(fin_eth_bal1 < init_eth_bal1);
    assert.equal(con_user_report_bal, 0);
  });

  it("Canceled/complete order should fail", async function(){
    const con = await DAOHQotc.deployed();
    const tok = await token.deployed();

    const price = web3.utils.toWei("1", 'ether');
    try{
      await con.fulfillOrder(order_id1, {from: accounts[1], value: price});
      assert.isTrue(false);
    }catch{
      assert.isTrue(true);
    }
  });
  
  // ETH sell test
  it("Should submit ETH Order", async function (){
    const con = await DAOHQotc.deployed();
    const tok = await token.deployed();
    const accounts = await web3.eth.getAccounts()
    const init_bal = web3.utils.toBN(await web3.eth.getBalance(accounts[0]))

    const amount = web3.utils.toWei("1", 'ether');

    const price = web3.utils.toWei("5", 'ether');


    await con.initiateOrder(
      tok.address,
      amount,
      price,
      3600, //1hr
      order_id2,
      true,
      {from: accounts[0], value: amount}
      )
    const final_bal = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    const con_bal = web3.utils.toBN(await web3.eth.getBalance(con.address));
    const con_report_bal = web3.utils.toBN(await con.getBalance(accounts[0], "0x0000000000000000000000000000000000000000"));
    assert.equal(con_bal.toString(), con_report_bal.toString());
    assert.equal(con_bal.toString(), amount.toString());
    assert.isTrue(init_bal > final_bal);
  });

  it("Order should fulfill for tokens", async function(){
    const con = await DAOHQotc.deployed();
    const tok = await token.deployed();
    const accounts = await web3.eth.getAccounts()
    const init_con_bal = web3.utils.toBN(await web3.eth.getBalance(con.address));
    const init_eth_bal1 = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));
    const init_erc_bal = web3.utils.toBN(await tok.balanceOf(accounts[0]));

    const price = web3.utils.toWei("5", 'ether');
    const amount = web3.utils.toWei("1", 'ether');
    await tok.approve(con.address, price, {from: accounts[1]});
    await con.fulfillOrder(order_id2, {from: accounts[1]});

    const fin_con_bal = web3.utils.toBN(await web3.eth.getBalance(con.address));
    const fin_eth_bal1 = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));
    const fin_erc_bal = web3.utils.toBN(await tok.balanceOf(accounts[0]));

    const con_user_report_bal = web3.utils.toBN(await con.getBalance(accounts[0], "0x0000000000000000000000000000000000000000"));

    assert.equal(init_con_bal - fin_con_bal, amount);
    assert.equal(fin_erc_bal - init_erc_bal, price);
    assert.isTrue(fin_eth_bal1 > init_eth_bal1);
    assert.equal(con_user_report_bal, 0);
  });

  // scenarios 

  it("Should revert when expired", async function(){
    const con = await DAOHQotc.deployed();
    const tok = await token.deployed();
    const accounts = await web3.eth.getAccounts()
    const amount = web3.utils.toWei("1", 'ether');

    const price = web3.utils.toWei("5", 'ether');


    await con.initiateOrder(
      tok.address,
      amount,
      price,
      1, //1hr
      order_id2,
      true,
      {from: accounts[1], value: amount}
      )

    setTimeout(() => {console.log("pausing")}, 10000);
    
    try{
      await tok.approve(con.address, price, {from: accounts[0]});
      await con.fulfillOrder(order_id2, {from: accounts[0]});
      assert.isTrue(false)
    }catch{
      const con_user_report_bal = web3.utils.toBN(await con.getBalance(accounts[1], "0x0000000000000000000000000000000000000000"));
      assert.equal(con_user_report_bal.toString(), amount.toString());
    }
  });

  it("Should cancel Order and collect ETH", async function(){
    const con = await DAOHQotc.deployed();
    const accounts = await web3.eth.getAccounts()

    const init_con_bal = web3.utils.toBN(await web3.eth.getBalance(con.address));
    const init_eth_bal1 = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));
    console.log(init_eth_bal1)
    const amount = web3.utils.toWei("1", 'ether');
    await con.cancelWithdrawOrder(order_id2, {from: accounts[1]});

    const fin_con_bal = web3.utils.toBN(await web3.eth.getBalance(con.address));
    const fin_eth_bal1 = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));
    const con_report_bal = web3.utils.toBN(await con.getBalance(accounts[1], "0x0000000000000000000000000000000000000000"));
    const res = await con.viewOrder(order_id2);

    assert.equal(fin_con_bal + con_report_bal, 0);
    assert.isTrue(fin_eth_bal1 > init_eth_bal1);
    assert.isTrue(!res[6]);
  });

  it("Should support multi order at different prices", async function(){
    const con = await DAOHQotc.deployed();
    const tok = await token.deployed();
    const accounts = await web3.eth.getAccounts()
    const order1 = 77
    const order2 = 88
    const bal_init = web3.utils.toBN(await tok.balanceOf(accounts[1]));
    const amount1 = web3.utils.toWei("5", 'ether');

    const price1 = web3.utils.toWei("1", 'ether');

    await tok.approve(con.address, amount1);

    await con.initiateOrder(
      tok.address,
      amount1,
      price1,
      3600, //1hr
      order1,
      false
      )
    

    const amount2 = web3.utils.toWei("6", 'ether');

    const price2 = web3.utils.toWei("2", 'ether');

    await tok.approve(con.address, amount2);

    await con.initiateOrder(
      tok.address,
      amount2,
      price2,
      3600, //1hr
      order2,
      false
      )

    const init_token_av = web3.utils.toBN(await con.getBalance(accounts[0], tok.address));
    await con.fulfillOrder(order1, {from: accounts[1], value: price1});
    const fin_token_av = web3.utils.toBN(await con.getBalance(accounts[0], tok.address));
    assert.equal(init_token_av - fin_token_av, amount1)

    const init_token_av2 = web3.utils.toBN(await con.getBalance(accounts[0], tok.address));
    await con.fulfillOrder(order2, {from: accounts[1], value: price2});
    const fin_token_av2 = web3.utils.toBN(await con.getBalance(accounts[0], tok.address));
    assert.equal(init_token_av2 - fin_token_av2, amount2)

    const bal_fin = web3.utils.toBN(await tok.balanceOf(accounts[1]));

    assert.equal(bal_fin - bal_init, parseInt(amount2) + parseInt(amount1))

    });
});
