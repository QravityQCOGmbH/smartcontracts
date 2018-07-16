pragma solidity ^0.4.11;

import 'zeppelin/token/ERC20Basic.sol';
import 'zeppelin/math/SafeMath.sol';

contract QravityTeamTimelock {
    using SafeMath for uint256;

    uint16 constant ORIGIN_YEAR = 1970;

    // Account that can release tokens
    address public controller;

    uint256 public releasedAmount;

    ERC20Basic token;

    function QravityTeamTimelock(ERC20Basic _token, address _controller)
    public
    {
        require(address(_token) != 0x0);
        require(_controller != 0x0);
        token = _token;
        controller = _controller;
    }

    /**
     * @notice Transfers tokens held by timelock to beneficiary.
     */
    function release(address _beneficiary, uint256 _amount)
    public
    {
        require(msg.sender == controller);
        require(_amount > 0);
        require(_amount <= availableAmount(now));
        token.transfer(_beneficiary, _amount);
        releasedAmount = releasedAmount.add(_amount);
    }

    function availableAmount(uint256 timestamp)
    public view
    returns (uint256 amount)
    {
        uint256 totalWalletAmount = releasedAmount.add(token.balanceOf(this));
        uint256 canBeReleasedAmount = totalWalletAmount.mul(availablePercent(timestamp)).div(100);
        return canBeReleasedAmount.sub(releasedAmount);
    }

    function availablePercent(uint256 timestamp)
    public view
    returns (uint256 factor)
    {
       uint256[10] memory releasePercent = [uint256(0), 20, 30, 40, 50, 60, 70, 80, 90, 100];
       uint[10] memory releaseTimes = [
           toTimestamp(2020, 4, 1),
           toTimestamp(2020, 7, 1),
           toTimestamp(2020, 10, 1),
           toTimestamp(2021, 1, 1),
           toTimestamp(2021, 4, 1),
           toTimestamp(2021, 7, 1),
           toTimestamp(2021, 10, 1),
           toTimestamp(2022, 1, 1),
           toTimestamp(2022, 4, 1),
           0
        ];

        // Set default to the 0% bonus.
        uint256 timeIndex = 0;

        for (uint256 i = 0; i < releaseTimes.length; i++) {
            if (timestamp < releaseTimes[i] || releaseTimes[i] == 0) {
                timeIndex = i;
                break;
            }
        }
        return releasePercent[timeIndex];
    }

    // Timestamp functions based on
    // https://github.com/pipermerriam/ethereum-datetime/blob/master/contracts/DateTime.sol
    function toTimestamp(uint16 year, uint8 month, uint8 day)
    internal pure returns (uint timestamp) {
        uint16 i;

        // Year
        timestamp += (year - ORIGIN_YEAR) * 1 years;
        timestamp += (leapYearsBefore(year) - leapYearsBefore(ORIGIN_YEAR)) * 1 days;

        // Month
        uint8[12] memory monthDayCounts;
        monthDayCounts[0] = 31;
        if (isLeapYear(year)) {
                monthDayCounts[1] = 29;
        }
        else {
                monthDayCounts[1] = 28;
        }
        monthDayCounts[2] = 31;
        monthDayCounts[3] = 30;
        monthDayCounts[4] = 31;
        monthDayCounts[5] = 30;
        monthDayCounts[6] = 31;
        monthDayCounts[7] = 31;
        monthDayCounts[8] = 30;
        monthDayCounts[9] = 31;
        monthDayCounts[10] = 30;
        monthDayCounts[11] = 31;

        for (i = 1; i < month; i++) {
            timestamp += monthDayCounts[i - 1] * 1 days;
        }

        // Day
        timestamp += (day - 1) * 1 days;

        // Hour, Minute, and Second are assumed as 0 (we calculate in GMT)

        return timestamp;
    }

    function leapYearsBefore(uint year)
    internal pure returns (uint) {
        year -= 1;
        return year / 4 - year / 100 + year / 400;
    }

    function isLeapYear(uint16 year)
    internal pure returns (bool) {
        if (year % 4 != 0) {
            return false;
        }
        if (year % 100 != 0) {
            return true;
        }
        if (year % 400 != 0) {
            return false;
        }
        return true;
    }
}
