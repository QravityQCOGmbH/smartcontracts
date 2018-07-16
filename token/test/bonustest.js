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

const TestTokenContract = artifacts.require("./QCOTestToken.sol");

contract('TestToken deployed', function (accounts) {

    it("should have an address", async function () {
        let theToken = await TestTokenContract.deployed();
        theToken.should.exist;
    });

    it("should have correct bonus scheme", async function () {
        let theToken = await TestTokenContract.deployed();
        let datePhase0 = (new Date("2018-08-11")).getTime() / 1000; // July 28 - August 11, 2018, Presale, 30% bonus
        let endPhase0 = (new Date("2018-08-12")).getTime() / 1000;
        let datePhase1 = (new Date("2018-08-21")).getTime() / 1000; // August 12 - 21, 2018, 10 days, 25% bonus
        let endPhase1 = (new Date("2018-08-22")).getTime() / 1000;
        let datePhase2 = (new Date("2018-08-31")).getTime() / 1000; // August 22 - 31, 2018, 10 days, 20% bonus
        let endPhase2 = (new Date("2018-09-01")).getTime() / 1000;
        let datePhase3 = (new Date("2018-09-10")).getTime() / 1000; // September 1 - 10, 2018, 10 days, 15% bonus
        let endPhase3 = (new Date("2018-09-11")).getTime() / 1000;
        let datePhase4 = (new Date("2018-09-20")).getTime() / 1000; // September 11 - 20, 2018, 10 days, 10% bonus
        let endPhase4 = (new Date("2018-09-21")).getTime() / 1000;
        let datePhase5 = (new Date("2018-09-30")).getTime() / 1000; // September 21 - 30, 2018, 10 days, 5% bonus
        let endPhase5 = (new Date("2018-10-01")).getTime() / 1000;
        let datePhase6 = (new Date("2018-10-02")).getTime() / 1000; // October 1, 2018, and later, 0% bonus
        let endPhase6 = 0;
        (await theToken.getBonusFactor(datePhase0)).should.be.bignumber.equal(300);
        (await theToken.getBonusFactor(datePhase1)).should.be.bignumber.equal(250);
        (await theToken.getBonusFactor(datePhase2)).should.be.bignumber.equal(200);
        (await theToken.getBonusFactor(datePhase3)).should.be.bignumber.equal(150);
        (await theToken.getBonusFactor(datePhase4)).should.be.bignumber.equal(100);
        (await theToken.getBonusFactor(datePhase5)).should.be.bignumber.equal(50);
        (await theToken.getBonusFactor(datePhase6)).should.be.bignumber.equal(0);
        (await theToken.getFollowingCutoffTime(datePhase0)).should.be.bignumber.equal(endPhase0);
        (await theToken.getFollowingCutoffTime(datePhase1)).should.be.bignumber.equal(endPhase1);
        (await theToken.getFollowingCutoffTime(datePhase2)).should.be.bignumber.equal(endPhase2);
        (await theToken.getFollowingCutoffTime(datePhase3)).should.be.bignumber.equal(endPhase3);
        (await theToken.getFollowingCutoffTime(datePhase4)).should.be.bignumber.equal(endPhase4);
        (await theToken.getFollowingCutoffTime(datePhase5)).should.be.bignumber.equal(endPhase5);
        (await theToken.getFollowingCutoffTime(datePhase6)).should.be.bignumber.equal(endPhase6);
        // Basically just makes sure those can be called, don't worry about their values too much.
        (await theToken.getNextCutoffTime()).should.be.bignumber.not.above(endPhase5);
        (await theToken.getCurrentBonusFactor()).should.be.bignumber.not.above(300);
    });

});
