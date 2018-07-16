/*
Implements ERC 20 Token standard: https://github.com/ethereum/EIPs/issues/20.
*/
pragma solidity ^0.4.11;


import "./QCOToken.sol";
contract QCOTestToken is QCOToken {
    function QCOTestToken(
        address _stateControl
    , address _whitelistControl
    , address _withdraw
    , address _tokenAssignmentControl
    , address _teamControl
    , address _reserves
    ) public
    QCOToken(_stateControl,_whitelistControl, _withdraw, _tokenAssignmentControl, _teamControl, _reserves) {
    }

    function getBonusFactor(uint timestamp)
    public view returns (uint256 factor)
    {
        return Bonus.getBonusFactor(timestamp, bonusData);
    }

    function getFollowingCutoffTime(uint timestamp)
    public view returns (uint nextTime)
    {
        return Bonus.getFollowingCutoffTime(timestamp, bonusData);
    }
}
