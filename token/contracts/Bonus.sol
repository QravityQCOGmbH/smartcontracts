pragma solidity ^0.4.11;

library Bonus {
    uint16 constant ORIGIN_YEAR = 1970;
    struct BonusData {
        uint[7] factors; // aditional entry for 0% bonus
        uint[6] cutofftimes;
    }

    // Use storage keyword so that we write this to persistent storage.
    function initBonus(BonusData storage data)
    internal
    {
        data.factors = [uint256(300), 250, 200, 150, 100, 50, 0];
        data.cutofftimes = [toTimestamp(2018, 8, 12),
                            toTimestamp(2018, 8, 22),
                            toTimestamp(2018, 9, 1),
                            toTimestamp(2018, 9, 11),
                            toTimestamp(2018, 9, 21),
                            toTimestamp(2018, 10, 1)];
    }

    function getBonusFactor(uint timestamp, BonusData storage data)
    internal view returns (uint256 factor)
    {
        uint256 countcutoffs = data.cutofftimes.length;
        // Set default to the 0% bonus.
        uint256 timeIndex = countcutoffs;

        for (uint256 i = 0; i < countcutoffs; i++) {
            if (timestamp < data.cutofftimes[i]) {
                timeIndex = i;
                break;
            }
        }

        return data.factors[timeIndex];
    }

    function getFollowingCutoffTime(uint timestamp, BonusData storage data)
    internal view returns (uint nextTime)
    {
        uint256 countcutoffs = data.cutofftimes.length;
        // Set default to 0 meaning "no cutoff any more".
        nextTime = 0;

        for (uint256 i = 0; i < countcutoffs; i++) {
            if (timestamp < data.cutofftimes[i]) {
                nextTime = data.cutofftimes[i];
                break;
            }
        }

        return nextTime;
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
