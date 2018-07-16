const DeployingToken = artifacts.require("./QCOToken.sol");
const TestToken = artifacts.require("./QCOTestToken.sol");

module.exports = function (deployer, network, account) {

    let doNotUse;
    let stateControl;
    let whitelistControl;
    let withdrawControl;
    let tokenAssignmentControl;
    let teamControl;
    let reserves;
    let gasLimit = 4000000;

    if (network === "live") {
        console.log("please configure live", whitelist);

    } else if (network === "ropsten") {

        doNotUse = "0x71dff39c678a2d99934a45e9d542138a4e87e3fe";
        stateControl = "0x505c27ce9365a240a68cf08834bbb9ca832e2f53";
        whitelistControl = "0x70a39347677cc2abc581bd1a0eb841ae29d66563";
        withdrawControl = "0x5027308a0847e5cbe9671062b4433f819fc3cfa3";
        tokenAssignmentControl = "0xac6087f0b8834224b6d6d25a4e5f3cb654be132b";
        teamControl = "0xf951fc649128290839ff512a81f607e4646ac2e5";
        reserves = "0x22251bf1b2870799c3dbea618714414a4d6a4a34";

    } else if (network === "development") {
        // testrpc
        doNotUse = account[0];
        stateControl = account[1];
        whitelistControl = account[2];
        withdrawControl = account[3];
        tokenAssignmentControl = account[4];
        teamControl = account[5];
        reserves = account[6];
    } else if (network === "coverage") {
        // testrpc-sc
        doNotUse = account[0];
        stateControl = account[1];
        whitelistControl = account[2];
        withdrawControl = account[3];
        tokenAssignmentControl = account[4];
        teamControl = account[5];
        reserves = account[6];
        gasLimit = 0xfffffffffff;
    }
    const deployedAddress = deployer.deploy(DeployingToken,
        stateControl,
        whitelistControl,
        withdrawControl,
        tokenAssignmentControl,
        teamControl,
        reserves
        , {gas: gasLimit, from: account[0]}
    );
    if (network === "development" || network === "coverage") {
        const deployedAddress = deployer.deploy(TestToken,
            stateControl,
            whitelistControl,
            withdrawControl,
            tokenAssignmentControl,
            teamControl,
            reserves
            , {gas: gasLimit, from: account[0]}
        );
    }
};
