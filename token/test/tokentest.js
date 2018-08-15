import EVMThrow from './helpers/EVMThrow'

import {
    advanceBlock,
    advanceToBlock,
    increaseTime,
    increaseTimeTo,
    duration,
    revert,
    latestTime
} from 'truffle-test-helpers';

const BigNumber = web3.BigNumber;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const TokenContract = artifacts.require("./QCOToken.sol");
const TeamWalletContract = artifacts.require("./QravityTeamTimelock.sol");


contract('Token funded', function (accounts) {


    const defaultKeyDoNotUse = accounts[0];
    const expectedStateControl = accounts[1];
    const expectedWhitelist = accounts[2];
    const expectedWithdraw = accounts[3];
    const expectedTokenAssignmentControl = accounts[4];
    const expectedTeamControl = accounts[5];
    const expectedReserves = accounts[6];

    const user1 = accounts[7];
    const user2 = accounts[8];
    const user3 = accounts[9];

    const user1SendFunds = web3.toWei(1, "ether");

    const ETH_QCO = 5000;
    // must be adapted with number of tests
    const endBlock = 40;

    // this data structure must be kept in sync with States enum in the token's .sol
    const States = {
        Initial: 0, // deployment time
        ValuationSet: 1, // whitelist addresses, accept funds, update balances
        Ico: 2, // whitelist addresses, accept funds, update balances
        Aborted: 3, // ICO aborted
        Operational: 4, // production phase
        Paused: 5         // for contract upgrades
    };

    it("should have an address", async function () {
        let theToken = await TokenContract.deployed();
        theToken.should.exist;
    });

    it("should have an owner from our known accounts", async function () {
        let theToken = await TokenContract.deployed();
        // Compare hex strings instead of numbers so errors become more readable.
        (await theToken.stateControl()).toString(16).should.be.equal(expectedStateControl.toString(16));
        (await theToken.whitelistControl()).toString(16).should.be.equal(expectedWhitelist.toString(16));
        (await theToken.withdrawControl()).toString(16).should.be.equal(expectedWithdraw.toString(16));
        (await theToken.tokenAssignmentControl()).toString(16).should.be.equal(expectedTokenAssignmentControl.toString(16));
        (await theToken.reserves()).toString(16).should.be.equal(expectedReserves.toString(16));
    });

    it("should be in Initial state", async function () {
        let theToken = await TokenContract.deployed();
        (await theToken.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should have initial account balances", async function () {
        let theToken = await TokenContract.deployed();
        const teamWallet = await theToken.teamWallet();
        (await theToken.balanceOf(teamWallet)).should.be.bignumber.equal(0);
        const reservesTokens = await theToken.balanceOf(expectedReserves);
        reservesTokens.should.be.bignumber.equal(await theToken.maxTotalSupply());
    });

    it("should not allow a token transfer in Inital state", async function () {
        let theToken = await TokenContract.deployed();
        const tokenSendAmount = 0;
        await theToken.transfer(user3, tokenSendAmount, {from: expectedReserves}).should.be.rejectedWith(revert);
    });

    it("should reject adding a presale amount during Initial.", async function () {
        let theToken = await TokenContract.deployed();
        const presaleAmount = 1000;
        // fails from others than the token assignment control account
        await theToken.addPresaleAmount(user2, presaleAmount, {from: expectedTokenAssignmentControl}).should.be.rejectedWith(revert);
        (await theToken.balanceOf(user2)).should.be.bignumber.equal(0);
    });

    it("should reject setting ICO variables without stateControlKey.", async function () {
        let theToken = await TokenContract.deployed();
        (await theToken.state()).should.be.bignumber.equal(States.Initial);
        (await theToken.ETH_QCO()).should.be.bignumber.equal(0);
        (await theToken.endBlock()).should.be.bignumber.equal(0);
        await theToken.updateEthICOVariables(ETH_QCO, endBlock, {from: user1}).should.be.rejected;
        (await theToken.ETH_QCO()).should.be.bignumber.equal(0);
        (await theToken.endBlock()).should.be.bignumber.equal(0);
        (await theToken.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should not let ICO start without correct key or without setting variables.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.startICO().should.be.rejectedWith(revert);
        await theToken.startICO({from: expectedStateControl}).should.be.rejectedWith(revert);
        // success keys is tested later on, in "should start ICO." (after updateEthICOVariables has been called successfully)
    });

    it("should reject 0 rate value.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.updateEthICOVariables(0, endBlock, {from: expectedStateControl}).should.be.rejectedWith(revert);
        (await theToken.ETH_QCO()).should.be.bignumber.equal(0);
        (await theToken.endBlock()).should.be.bignumber.equal(0);
        (await theToken.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should reject 0 end value.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.updateEthICOVariables(ETH_QCO, 0, {from: expectedStateControl}).should.be.rejectedWith(revert);
        (await theToken.ETH_QCO()).should.be.bignumber.equal(0);
        (await theToken.endBlock()).should.be.bignumber.equal(0);
        (await theToken.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should reject non-future block.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.updateEthICOVariables(ETH_QCO, web3.eth.getBlock("latest").number, {from: expectedStateControl}).should.be.rejectedWith(revert);
        (await theToken.ETH_QCO()).should.be.bignumber.equal(0);
        (await theToken.endBlock()).should.be.bignumber.equal(0);
        (await theToken.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should accept correct min and max values with correct key.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.updateEthICOVariables(ETH_QCO, endBlock, {from: expectedStateControl}).should.not.be.rejected;
        (await theToken.ETH_QCO()).should.be.bignumber.equal(ETH_QCO);
        (await theToken.endBlock()).should.be.bignumber.equal(endBlock);
        (await theToken.state()).should.be.bignumber.equal(States.ValuationSet);
    });

    it("should allow adding a presale amount during Valuation.", async function () {
        let theToken = await TokenContract.deployed();
        const balanceBefore = (await theToken.balanceOf(user2));
        const presaleAmount = 1000;
        // fails from others than the token assignment control account
        await theToken.addPresaleAmount(user2, presaleAmount).should.be.rejectedWith(revert);
        await theToken.addPresaleAmount(user2, presaleAmount, {from: expectedTokenAssignmentControl}).should.not.be.rejected;
        (await theToken.balanceOf(user2)).should.be.bignumber.equal(balanceBefore.plus(presaleAmount));
    });

    it("should start ICO.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.startICO({from: expectedStateControl}).should.not.be.rejected;
        (await theToken.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should reject updating ICO variables when ICO started.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.updateEthICOVariables(ETH_QCO, endBlock, {from: expectedStateControl}).should.be.rejectedWith(revert);
    });

    it("should reject starting ICO again when it's already running.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.startICO({from: expectedStateControl}).should.be.rejectedWith(revert);
        (await theToken.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should not whitelist by default address user1.", async function () {
        let theToken = await TokenContract.deployed();
        let isUser1Whitelisted = await theToken.whitelist(user1);
        isUser1Whitelisted.should.equal(false);
    });

    it("should fail to whitelist address user1 without correct key.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.addToWhitelist(user1).should.be.rejectedWith(revert);
        let isUser1Whitelisted = await theToken.whitelist(user1);
        isUser1Whitelisted.should.equal(false);
    });

    it("should fail to accept funds from non whitelisted address user1.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.sendTransaction({from: user1, value: user1SendFunds}).should.be.rejectedWith(revert);
    });

    it("should whitelist address user1 with correct key.", async function () {
        let theToken = await TokenContract.deployed();
        const callResult = await theToken.addToWhitelist(user1, {from: expectedWhitelist}).should.not.be.rejected;
        const expWhitelistEvent = callResult.logs[0];
        expWhitelistEvent.event.should.be.equal('Whitelisted');
        expWhitelistEvent.args.addr.should.be.equal(user1);
        let isUser1Whitelisted = await theToken.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
    });

    it("should fail to accept 0 ETH transactions or unknown function calls from whitelisted address user1.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.sendTransaction({from: user1, value: 0}).should.be.rejectedWith(revert);
        await theToken.sendTransaction({from: user1, value: 1, data: web3.fromAscii('foobar')}).should.be.rejectedWith(revert);
    });

    it("should accept funds from whitelisted address user1.", async function () {
        let theToken = await TokenContract.deployed();
        let isUser1Whitelisted = await theToken.whitelist(user1);
        const preBalance = web3.eth.getBalance(theToken.address);
        const preSold = await theToken.soldTokens();
        const teamWallet = await theToken.teamWallet();
        const teamTokens = await theToken.balanceOf(teamWallet);
        preBalance.should.be.bignumber.equal(0);
        isUser1Whitelisted.should.equal(true);
        const etherSentToContract = new BigNumber(user1SendFunds);
        const sendTransaction = theToken.sendTransaction({from: user1, value: etherSentToContract});
        const callResult = await sendTransaction.should.not.be.rejected;
        const newBalance = web3.eth.getBalance(theToken.address);
        preBalance.plus(etherSentToContract).should.be.bignumber.equal(newBalance);
        const minBonusFactor = 1.0; // minimum expected factor, actual depends on bonus scheme.
        const maxBonusFactor = 1.75; // maximum expected factor, actual depends on bonus scheme.
        const minExpectedTokenAmount = (await theToken.ETH_QCO()).times(etherSentToContract).times(minBonusFactor);
        const maxExpectedTokenAmount = (await theToken.ETH_QCO()).times(etherSentToContract).times(maxBonusFactor);
        const expTxEvent = callResult.logs[0];
        // Transfer(from: <address>, to: <address>, value: <token_subdivision_amount>)
        expTxEvent.event.should.be.equal('Transfer');
        expTxEvent.args.from.should.be.equal(expectedReserves); // on this specific token contract!
        expTxEvent.args.to.should.be.equal(user1);
        // Test for not below (equal or higher) to be safe on time-based bonus changes).
        const actualTokenAmount = expTxEvent.args.value;
        actualTokenAmount.should.be.bignumber.not.below(minExpectedTokenAmount);
        actualTokenAmount.should.be.bignumber.not.above(maxExpectedTokenAmount);
        (await theToken.ethPossibleRefunds(user1)).should.be.bignumber.equal(etherSentToContract);
        (await theToken.balanceOf(expectedReserves)).plus(actualTokenAmount).plus(preSold).plus(teamTokens)
            .should.be.bignumber.equal(await theToken.totalSupply());
    });

    it("should fail to accept funds above the limit from whitelisted address user1.", async function () {
        let theToken = await TokenContract.deployed();
        const maxTokenSale = (await theToken.maxTotalSupply()).times(await theToken.percentForSale()).dividedBy(100);
        const weiICOMaximum = maxTokenSale.div(await theToken.ETH_QCO());
        const txAmount = weiICOMaximum.add(web3.toWei(1, "ether")).toFixed(0);
        await theToken.sendTransaction({from: user1, value: txAmount}).should.be.rejectedWith(revert);
    });

    it("should allow adding a presale amount during ICO.", async function () {
        let theToken = await TokenContract.deployed();
        const balanceBefore = (await theToken.balanceOf(user2));
        const reservesBefore = (await theToken.balanceOf(expectedReserves));
        const soldBefore = (await theToken.soldTokens());
        const totalBefore = (await theToken.totalSupply());
        const presaleAmount = new BigNumber(1000);
        const callResult = await theToken.addPresaleAmount(user2, presaleAmount, {from: expectedTokenAssignmentControl}).should.not.be.rejected;
        const expTxEvent = callResult.logs[0];
        expTxEvent.event.should.be.equal('Transfer');
        expTxEvent.args.from.should.be.equal(expectedReserves); // on this specific token contract!
        expTxEvent.args.to.should.be.equal(user2);
        expTxEvent.args.value.should.be.bignumber.equal(presaleAmount);
        (await theToken.balanceOf(user2)).should.be.bignumber.equal(balanceBefore.plus(presaleAmount));
        (await theToken.balanceOf(expectedReserves)).should.be.bignumber.equal(reservesBefore.minus(presaleAmount));
        (await theToken.soldTokens()).should.be.bignumber.equal(soldBefore.plus(presaleAmount));
        (await theToken.totalSupply()).should.be.bignumber.equal(totalBefore);
        // addPresaleAmount should not allow integer overflow! We try with a value that would overflow to 1
        const targetedHugeAmount = (new BigNumber(2)).pow(256).minus(balanceBefore.plus(presaleAmount)).plus(1);
        await theToken.addPresaleAmount(user2, targetedHugeAmount, {from: expectedTokenAssignmentControl}).should.be.rejectedWith(EVMThrow);
        (await theToken.balanceOf(user2)).should.be.bignumber.equal(balanceBefore.plus(presaleAmount));
    });

    it("should reject release from a timelock contract.", async function () {
        let theToken = await TokenContract.deployed();
        const teamWallet = await theToken.teamWallet();
        let timelock = TeamWalletContract.at(teamWallet);
        await timelock.release(user1, 1, {from: expectedTeamControl}).should.be.rejectedWith(revert);
    });

    it("should fail to stop ICO by anyone before ICO timeout.", async function () {
        let theToken = await TokenContract.deployed();
        (await theToken.state()).should.be.bignumber.equal(States.Ico);
        await theToken.anyoneEndICO().should.be.rejected;
        (await theToken.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should reject funds from whitelisted address user1 after ICO timeout.", async function () {
        let theToken = await TokenContract.deployed();
        // make sure another investment works before the time jump, after which it is rejected.
        const investAmount = web3.toWei(0.001, "ether");
        await theToken.sendTransaction({from: user1, value: investAmount}).should.not.be.rejected;
        await advanceToBlock(endBlock + 1);
        await theToken.sendTransaction({from: user1, value: investAmount}).should.be.rejectedWith(revert);
    });

    it("should not allow a token transfer in ICO phase", async function () {
        let theToken = await TokenContract.deployed();
        const balanceBefore1 = (await theToken.balanceOf(user1));
        const balanceBefore3 = (await theToken.balanceOf(user3));
        const tokenSendAmount = web3.toWei(1, "ether"); // token has same conversion as ether->wei
        await theToken.transfer(user3, tokenSendAmount, {from: user1}).should.be.rejectedWith(revert);
        (await theToken.balanceOf(user1)).should.be.bignumber.equal(balanceBefore1);
        (await theToken.balanceOf(user3)).should.be.bignumber.equal(balanceBefore3);
    });

    it("should reject ETH withdrawal when still in ICO phase.", async function () {
        let theToken = await TokenContract.deployed();
        const withdrawAmount = (new BigNumber(web3.toWei(0.1, "ether")));
        await theToken.requestPayout(withdrawAmount, {from: expectedWithdraw}).should.be.rejectedWith(revert);
    });

    it("should accept stopping ICO by anyone after ICO timeout.", async function () {
        let theToken = await TokenContract.deployed();
        (await theToken.state()).should.be.bignumber.equal(States.Ico);
        const soldTokens = await theToken.soldTokens();
        const reservesBefore = (await theToken.balanceOf(expectedReserves));
        const callResult = await theToken.anyoneEndICO().should.not.be.rejected;
        const totalSupply = await theToken.totalSupply();
        const reservesAfter = (await theToken.balanceOf(expectedReserves));
        const teamWallet = await theToken.teamWallet();
        const teamTokens = await theToken.balanceOf(teamWallet);
        const expTxEvent1 = callResult.logs[0];
        expTxEvent1.event.should.be.equal('Transfer');
        expTxEvent1.args.from.should.be.equal(expectedReserves);
        expTxEvent1.args.to.should.be.equal(await theToken.teamWallet());
        expTxEvent1.args.value.should.be.bignumber.equal(totalSupply.mul(22).div(100));
        expTxEvent1.args.value.should.be.bignumber.equal(teamTokens);
        const expTxEvent2 = callResult.logs[1];
        expTxEvent2.event.should.be.equal('Transfer');
        expTxEvent2.args.from.should.be.equal(expectedReserves);
        expTxEvent2.args.to.should.be.equal('0x0000000000000000000000000000000000000000');
        // Burned amount is difference of reserves minus the team tokens.
        expTxEvent2.args.value.should.be.bignumber.equal(reservesBefore.minus(reservesAfter).minus(teamTokens));
        const expFinishedEvent = callResult.logs[2];
        expFinishedEvent.event.should.be.equal('MintFinished');
        const expStateEvent = callResult.logs[3];
        expStateEvent.event.should.be.equal('StateTransition');
        expStateEvent.args.oldState.should.be.bignumber.equal(States.Ico);
        expStateEvent.args.newState.should.be.bignumber.equal(States.Operational);
        totalSupply.should.be.bignumber.not.above(await theToken.maxTotalSupply());
        (await theToken.state()).should.be.bignumber.equal(States.Operational);
    });

    it("should have final amounts and account balances", async function () {
        let theToken = await TokenContract.deployed();
        const totalSupply = await theToken.totalSupply();
        const soldTokens = await theToken.soldTokens();
        soldTokens.should.be.bignumber.equal(totalSupply.times(await theToken.percentForSale()).div(100));
        const reservesTokens = await theToken.balanceOf(expectedReserves);
        const teamWallet = await theToken.teamWallet();
        const teamTokens = await theToken.balanceOf(teamWallet);
        teamTokens.should.be.bignumber.above(0);
        reservesTokens.plus(teamTokens).plus(soldTokens).should.be.bignumber.equal(totalSupply);
    });

    it("should reject starting ICO again when it's already ended.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.startICO({from: expectedStateControl}).should.be.rejectedWith(revert);
        (await theToken.state()).should.be.bignumber.equal(States.Operational);
    });

    it("should reject adding a presale amount after ICO.", async function () {
        let theToken = await TokenContract.deployed();
        const balanceBefore = (await theToken.balanceOf(user2));
        const presaleAmount = 1000;
        // fails from others than the token assignment control account
        await theToken.addPresaleAmount(user2, presaleAmount, {from: expectedTokenAssignmentControl}).should.be.rejectedWith(revert);
        (await theToken.balanceOf(user2)).should.be.bignumber.equal(balanceBefore);
    });

    it("should allow ETH withdrawal after ICO.", async function () {
        let theToken = await TokenContract.deployed();
        const withdrawAmount = (new BigNumber(web3.toWei(0.1, "ether")));
        const preBalance = web3.eth.getBalance(theToken.address);
        preBalance.should.be.bignumber.above(withdrawAmount);
        const withdrawPreBalance = web3.eth.getBalance(expectedWithdraw);
        // fails from others than the withdraw control account
        await theToken.requestPayout(withdrawAmount).should.be.rejectedWith(revert);
        const callResult = await theToken.requestPayout(withdrawAmount, {from: expectedWithdraw}).should.not.be.rejected;
        const tx = await web3.eth.getTransaction(callResult.tx);
        const txCost = tx.gasPrice.times(callResult.receipt.gasUsed);
        web3.eth.getBalance(theToken.address).should.be.bignumber.equal(preBalance.minus(withdrawAmount));
        web3.eth.getBalance(expectedWithdraw).should.be.bignumber.equal(withdrawPreBalance.plus(withdrawAmount).minus(txCost));
    });

    it("should allow setting allowance and allowed user to transferFrom() the tokens.", async function () {
        let theToken = await TokenContract.deployed();
        const approveAmount = (new BigNumber(web3.toWei(0.1, "ether")));
        const callResult = await theToken.approve(user2, approveAmount, {from: user1}).should.not.be.rejected;
        const expAllowEvent = callResult.logs[0];
        expAllowEvent.event.should.be.equal('Approval');
        expAllowEvent.args.owner.should.be.equal(user1);
        expAllowEvent.args.spender.should.be.equal(user2);
        expAllowEvent.args.value.should.be.bignumber.equal(approveAmount);
        (await theToken.allowance(user1, user2)).should.be.bignumber.equal(approveAmount);
    });

    it("should allow to transferFrom() the allowed tokens.", async function () {
        let theToken = await TokenContract.deployed();
        const approveAmount = (await theToken.allowance(user1, user2));
        const preBalanceUser1 = (await theToken.balanceOf(user1));
        const preBalanceUser2 = (await theToken.balanceOf(user2));
        preBalanceUser1.should.be.bignumber.above(approveAmount);
        // Sending to wrong users, too high amounts, or from others than the recipient fails.
        await theToken.transferFrom(user1, user3, approveAmount, {from: user3}).should.be.rejectedWith(EVMThrow);
        await theToken.transferFrom(user1, user2, approveAmount.plus(1), {from: user2}).should.be.rejectedWith(EVMThrow);
        await theToken.transferFrom(user1, user2, approveAmount).should.be.rejectedWith(EVMThrow);
        const callResult = await theToken.transferFrom(user1, user2, approveAmount, {from: user2}).should.not.be.rejected;
        const expTxEvent = callResult.logs[0];
        expTxEvent.event.should.be.equal('Transfer');
        expTxEvent.args.from.should.be.equal(user1);
        expTxEvent.args.to.should.be.equal(user2);
        expTxEvent.args.value.should.be.bignumber.equal(approveAmount);
        (await theToken.balanceOf(user1)).should.be.bignumber.equal(preBalanceUser1.minus(approveAmount));
        (await theToken.balanceOf(user2)).should.be.bignumber.equal(preBalanceUser2.plus(approveAmount));
        await theToken.transferFrom(user1, user2, 1, {from: user2}).should.be.rejectedWith(EVMThrow);
    });

    it("should allow to transfer tokens to the token address.", async function () {
        let theToken = await TokenContract.deployed();
        const preBalanceUser = (await theToken.balanceOf(user2));
        const preBalanceToken = (await theToken.balanceOf(theToken.address));
        preBalanceUser.should.be.bignumber.above(0);
        preBalanceToken.should.be.bignumber.equal(0);
        // Sending to wrong users, too high amounts, or from others than the recipient fails.
        const callResult = await theToken.transfer(theToken.address, preBalanceUser, {from: user2}).should.not.be.rejected;
        const expTxEvent = callResult.logs[0];
        expTxEvent.event.should.be.equal('Transfer');
        expTxEvent.args.from.should.be.equal(user2);
        expTxEvent.args.to.should.be.equal(theToken.address);
        expTxEvent.args.value.should.be.bignumber.equal(preBalanceUser);
        (await theToken.balanceOf(user2)).should.be.bignumber.equal(0);
        (await theToken.balanceOf(theToken.address)).should.be.bignumber.equal(preBalanceToken.plus(preBalanceUser));
        await theToken.transfer(theToken.address, 1, {from: user2}).should.be.rejectedWith(EVMThrow);
    });

    it("should allow rescuing tokens wrongly assigned to its own address.", async function () {
        let theToken = await TokenContract.deployed();
        const preBalanceUser = (await theToken.balanceOf(user1));
        const preBalanceToken = (await theToken.balanceOf(theToken.address));
        await theToken.rescueToken(theToken.address, user1).should.be.rejectedWith(revert);
        const callResult = await theToken.rescueToken(theToken.address, user1, {from: expectedTokenAssignmentControl}).should.not.be.rejected;
        const expTxEvent = callResult.logs[0];
        expTxEvent.event.should.be.equal('Transfer');
        expTxEvent.args.from.should.be.equal(theToken.address);
        expTxEvent.args.to.should.be.equal(user1);
        expTxEvent.args.value.should.be.bignumber.equal(preBalanceToken);
        (await theToken.balanceOf(theToken.address)).should.be.bignumber.equal(0);
        (await theToken.balanceOf(user1)).should.be.bignumber.equal(preBalanceToken.plus(preBalanceUser));
    });

    it("should still reject release from a timelock contract.", async function () {
        let theToken = await TokenContract.deployed();
        const teamWallet = await theToken.teamWallet();
        let timelock = TeamWalletContract.at(teamWallet);
        await timelock.release(user1, 1, {from: expectedTeamControl}).should.be.rejectedWith(revert);
    });

    it("should allow release from a timelock contract after expected times.", async function () {
        let theToken = await TokenContract.deployed();
        const teamWallet = await theToken.teamWallet();
        let timelock = TeamWalletContract.at(teamWallet);
        await increaseTimeTo((new Date("2020-03-31T23:50:00Z")).getTime() / 1000);
        await timelock.release(user1, 1, {from: expectedTeamControl}).should.be.rejectedWith(revert);
        let testSet = [{tstamp: (new Date("2020-04-01T00:10:00Z")).getTime() / 1000, pct: 20},
            {tstamp: (new Date("2020-07-01T00:10:00Z")).getTime() / 1000, pct: 30},
            {tstamp: (new Date("2020-10-01T00:10:00Z")).getTime() / 1000, pct: 40},
            {tstamp: (new Date("2021-01-01T00:10:00Z")).getTime() / 1000, pct: 50},
            {tstamp: (new Date("2021-04-01T00:10:00Z")).getTime() / 1000, pct: 60},
            {tstamp: (new Date("2021-07-01T00:10:00Z")).getTime() / 1000, pct: 70},
            {tstamp: (new Date("2021-10-01T00:10:00Z")).getTime() / 1000, pct: 80},
            {tstamp: (new Date("2022-01-01T00:10:00Z")).getTime() / 1000, pct: 90},
            {tstamp: (new Date("2022-04-01T00:10:00Z")).getTime() / 1000, pct: 100}];
        for (let i = 0; i < testSet.length; i++) {
            (await timelock.availablePercent(testSet[i].tstamp)).should.be.bignumber.equal(testSet[i].pct);
            (await timelock.availableAmount(testSet[i].tstamp)).should.be.bignumber.equal((await theToken.balanceOf(teamWallet)).mul(testSet[i].pct).div(100));
        }
        const initialAmount = (await theToken.balanceOf(teamWallet));
        const takeoutAmount = initialAmount.div(10); // 10%
        await increaseTimeTo(testSet[0].tstamp); // 20% stage
        await timelock.release(user1, takeoutAmount).should.be.rejectedWith(revert);
        await timelock.release(user1, takeoutAmount, {from: expectedTeamControl}).should.not.be.rejected;
        (await theToken.balanceOf(teamWallet)).should.be.bignumber.equal(initialAmount.sub(takeoutAmount));
        await increaseTimeTo(testSet[4].tstamp); // 60% stage
        await timelock.release(user1, takeoutAmount.mul(6)).should.be.rejectedWith(revert);
        await timelock.release(user1, takeoutAmount.mul(5), {from: expectedTeamControl}).should.not.be.rejected;
        (await theToken.balanceOf(teamWallet)).should.be.bignumber.equal(initialAmount.sub(takeoutAmount.mul(6)));
        await increaseTimeTo(testSet[testSet.length - 1].tstamp); // 100% stage
        const restAmount = await theToken.balanceOf(teamWallet);
        await timelock.release(user1, restAmount, {from: expectedTeamControl}).should.not.be.rejected;
        (await theToken.balanceOf(teamWallet)).should.be.bignumber.equal(0);
    });

});


contract('Token funded and stopped by admin and operational.', function (accounts) {

    const defaultKeyDoNotUse = accounts[0];
    const expectedStateControl = accounts[1];
    const expectedWhitelist = accounts[2];
    const expectedWithdraw = accounts[3];
    const expectedTokenAssignmentControl = accounts[4];
    const expectedTeamControl = accounts[5];
    const expectedReserves = accounts[6];

    const user1 = accounts[7];
    const user2 = accounts[8];
    const user3 = accounts[9];

    const ETH_QCO = 5000;
    // must be adapted with number of tests
    const endBlock = 40;

    const user1SendFunds = web3.toWei(1, "ether");

    // this data structure must be kept in sync with States enum in the token's .sol
    const States = {
        Initial: 0, // deployment time
        ValuationSet: 1, // whitelist addresses, accept funds, update balances
        Ico: 2, // whitelist addresses, accept funds, update balances
        Aborted: 3, // ICO aborted
        Operational: 4, // production phase
        Paused: 5         // for contract upgrades
    }

    it("should be in Initial state", async function () {
        let theToken = await TokenContract.deployed();
        (await theToken.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should accept valid min and max values with correct key.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.updateEthICOVariables(ETH_QCO, endBlock, {from: expectedStateControl}).should.not.be.rejected;
        (await theToken.ETH_QCO()).should.be.bignumber.equal(ETH_QCO);
        (await theToken.endBlock()).should.be.bignumber.equal(endBlock);
        (await theToken.state()).should.be.bignumber.equal(States.ValuationSet);
    });

    it("should start ICO.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.startICO({from: expectedStateControl});
        (await theToken.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should whitelist address user1 with correct key.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.addToWhitelist(user1, {from: expectedWhitelist}).should.not.be.rejected;
        let isUser1Whitelisted = await theToken.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
    });

    it("should accept funds from whitelisted address user1.", async function () {
        let theToken = await TokenContract.deployed();
        let isUser1Whitelisted = await theToken.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
        await theToken.sendTransaction({from: user1, value: user1SendFunds}).should.not.be.rejected;
    });

    it("should accept stopping ICO by admin before ICO timeout.", async function () {
        let theToken = await TokenContract.deployed();
        (await theToken.state()).should.be.bignumber.equal(States.Ico);
        await theToken.endICO({from: expectedStateControl}).should.not.be.rejected;
        (await theToken.state()).should.be.bignumber.equal(States.Operational);
    });

});


contract('TokenContract accepts large numbers of ICO invests small and large but respects cap. Funded and stopped by admin and operational.', function (accounts) {

    const defaultKeyDoNotUse = accounts[0];
    const expectedStateControl = accounts[1];
    const expectedWhitelist = accounts[2];
    const expectedWithdraw = accounts[3];
    const expectedTokenAssignmentControl = accounts[4];
    const expectedTeamControl = accounts[5];
    const expectedReserves = accounts[6];

    const user1 = accounts[7];
    const user2 = accounts[8];
    const user3 = accounts[9];

    const ETH_QCO = 5000;
    // must be adapted with number of tests
    const endBlock = 200;

    // this data structure must be kept in sync with States enum in the token's .sol
    const States = {
        Initial: 0, // deployment time
        ValuationSet: 1, // whitelist addresses, accept funds, update balances
        Ico: 2, // whitelist addresses, accept funds, update balances
        Aborted: 3, // ICO aborted
        Operational: 4, // production phase
        Paused: 5         // for contract upgrades
    }

    it("should be in Initial state", async function () {
        let theToken = await TokenContract.deployed();
        (await theToken.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should accept valid min and max values with correct key.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.updateEthICOVariables(ETH_QCO, endBlock, {from: expectedStateControl}).should.not.be.rejected;
        (await theToken.ETH_QCO()).should.be.bignumber.equal(ETH_QCO);
        (await theToken.endBlock()).should.be.bignumber.equal(endBlock);
        (await theToken.state()).should.be.bignumber.equal(States.ValuationSet);
    });

    it("should start ICO.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.startICO({from: expectedStateControl});
        (await theToken.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should whitelist address user1 with correct key.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.addToWhitelist(user1, {from: expectedWhitelist}).should.not.be.rejected;
        let isUser1Whitelisted = await theToken.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
    });

    it("should accept lots of small funds from whitelisted address user1.", async function () {
        let theToken = await TokenContract.deployed();
        let isUser1Whitelisted = await theToken.whitelist(user1);
        const preBalance =  web3.eth.getBalance(theToken.address);
        preBalance.should.be.bignumber.equal(0);
        let currentBalance = new BigNumber(0);
        const user1SendFunds = web3.toWei(0.001, "ether");
        isUser1Whitelisted.should.equal(true);
        for(let i = 0; i < 100; i++) {
            await theToken.sendTransaction({from: user1, value: user1SendFunds}).should.not.be.rejected;
            const postBalance = web3.eth.getBalance(theToken.address);
            currentBalance = currentBalance.plus(user1SendFunds);
            currentBalance.should.be.bignumber.equal(postBalance);
        }
    });

    it("should respect cap.", async function () {
        let theToken = await TokenContract.deployed();
        const user1SendFunds = new BigNumber(web3.toWei(0.001, "ether"));
        let maxTokenSale = (await theToken.percentForSale()).times(await theToken.maxTotalSupply()).dividedBy(100);
        let remainingTokens = maxTokenSale.minus(await theToken.soldTokens());
        let tokensWithBonus = await theToken.calcBonus(user1SendFunds);
        tokensWithBonus.should.be.bignumber.equal(user1SendFunds.plus(user1SendFunds.mul(await theToken.getCurrentBonusFactor()).div(1000)).mul(await theToken.ETH_QCO()));
        await theToken.addPresaleAmount(user1, remainingTokens.minus(tokensWithBonus), {from: expectedTokenAssignmentControl}).should.not.be.rejected;
        (await theToken.soldTokens()).should.be.bignumber.equal(maxTokenSale.minus(tokensWithBonus));
        let aBitTooMuch = user1SendFunds.plus(web3.toWei(0.0001, "ether"));
        await theToken.sendTransaction({from: user1, value: aBitTooMuch}).should.be.rejectedWith(revert);
        await theToken.addPresaleAmount(user1, tokensWithBonus.plus(100), {from: expectedTokenAssignmentControl}).should.be.rejectedWith(revert);
        await theToken.sendTransaction({from: user1, value: user1SendFunds}).should.not.be.rejected;
        (await theToken.soldTokens()).should.be.bignumber.equal(maxTokenSale);
    });

    it("should accept stopping ICO by admin before ICO timeout.", async function () {
        let theToken = await TokenContract.deployed();
        (await theToken.state()).should.be.bignumber.equal(States.Ico);
        await theToken.endICO({from: expectedStateControl}).should.not.be.rejected;
        (await theToken.state()).should.be.bignumber.equal(States.Operational);
    });

});


contract('TokenContract paused and restarted and aborted', function (accounts) {

    const defaultKeyDoNotUse = accounts[0];
    const expectedStateControl = accounts[1];
    const expectedWhitelist = accounts[2];
    const expectedWithdraw = accounts[3];
    const expectedTokenAssignmentControl = accounts[4];
    const expectedTeamControl = accounts[5];
    const expectedReserves = accounts[6];

    const user1 = accounts[7];
    const user2 = accounts[8];
    const user3 = accounts[9];

    const ETH_QCO = 5000;
    // must be adapted with number of tests
    const endBlock = 40;

    const user1SendFunds = web3.toWei(1, "ether");

    // this data structure must be kept in sync with States enum in the token's .sol
    const States = {
        Initial: 0, // deployment time
        ValuationSet: 1, // whitelist addresses, accept funds, update balances
        Ico: 2, // whitelist addresses, accept funds, update balances
        Aborted: 3, // ICO aborted
        Operational: 4, // production phase
        Paused: 5         // for contract upgrades
    }

    it("should be in Initial state", async function () {
        let theToken = await TokenContract.deployed();
        (await theToken.state()).should.be.bignumber.equal(States.Initial);
    });

    it("should accept valid min and max values with correct key.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.updateEthICOVariables(ETH_QCO, endBlock, {from: expectedStateControl}).should.not.be.rejected;
        (await theToken.ETH_QCO()).should.be.bignumber.equal(ETH_QCO);
        (await theToken.endBlock()).should.be.bignumber.equal(endBlock);
        (await theToken.state()).should.be.bignumber.equal(States.ValuationSet);
    });

    it("should start ICO.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.startICO({from: expectedStateControl});
        (await theToken.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should whitelist address user1 with correct key.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.addToWhitelist(user1, {from: expectedWhitelist}).should.not.be.rejected;
        let isUser1Whitelisted = await theToken.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
    });

    it("should accept funds from whitelisted address user1.", async function () {
        let theToken = await TokenContract.deployed();
        let isUser1Whitelisted = await theToken.whitelist(user1);
        isUser1Whitelisted.should.equal(true);
        await theToken.sendTransaction({from: user1, value: user1SendFunds}).should.not.be.rejected;
    });


    it("should not move to paused state when called with a user key.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.pause().should.be.rejectedWith(revert);
        (await theToken.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should move to paused state when called with state control key.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.pause({from: expectedStateControl});
        (await theToken.state()).should.be.bignumber.equal(States.Paused);
    });

    it("should not be resumed when called with a user key.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.resumeICO().should.be.rejectedWith(revert);
        (await theToken.state()).should.be.bignumber.equal(States.Paused);
    });

    it("should be resumed when called with state control key.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.resumeICO({from: expectedStateControl});
        (await theToken.state()).should.be.bignumber.equal(States.Ico);
    });

    it("should move again to paused state when called with state control key.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.pause({from: expectedStateControl});
        (await theToken.state()).should.be.bignumber.equal(States.Paused);
    });

    it("should be aborted when called with state control key.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.abort({from: expectedStateControl});
        (await theToken.state()).should.be.bignumber.equal(States.Aborted);
    });

    it("should reject new funding in underfunded state.", async function () {
        let theToken = await TokenContract.deployed();
        await theToken.sendTransaction({from: user1, value: web3.toWei(1, "ether")}).should.be.rejectedWith(revert);
    });

    it("should let users withdraw funds in underfunded state.", async function () {
        let theToken = await TokenContract.deployed();
        const pre = web3.eth.getBalance(user1);
        await theToken.requestRefund({from: user3, gasPrice: 0}).should.be.rejectedWith(revert);
        await theToken.requestRefund({from: user1, gasPrice: 0}).should.not.be.rejected;
        const post = web3.eth.getBalance(user1);
        post.minus(pre).should.be.bignumber.equal(user1SendFunds);
    });

});
