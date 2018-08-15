/*
Implements ERC 20 Token standard: https://github.com/ethereum/EIPs/issues/20.
*/
pragma solidity ^0.4.11;


import "zeppelin/token/StandardToken.sol";
import "./QravityTeamTimelock.sol";
import "./Bonus.sol";

contract QCOToken is StandardToken {

    // data structures
    enum States {
        Initial, // deployment time
        ValuationSet,
        Ico, // whitelist addresses, accept funds, update balances
        Aborted, // ICO aborted
        Operational, // production phase
        Paused         // for contract upgrades
    }

    mapping(address => uint256) public ethPossibleRefunds;

    uint256 public soldTokens;

    string public constant name = "Qravity Coin Token";

    string public constant symbol = "QCO";

    uint8 public constant decimals = 18;

    mapping(address => bool) public whitelist;

    address public stateControl;

    address public whitelistControl;

    address public withdrawControl;

    address public tokenAssignmentControl;

    address public teamWallet;

    address public reserves;

    States public state;

    uint256 public endBlock;

    uint256 public ETH_QCO; //number of tokens per ETH

    uint256 constant pointMultiplier = 1e18; //100% = 1*10^18 points

    uint256 public constant maxTotalSupply = 1000000000 * pointMultiplier; //1B tokens

    uint256 public constant percentForSale = 50;

    Bonus.BonusData bonusData;

    event Mint(address indexed to, uint256 amount);
    event MintFinished();

    bool public mintingFinished = false;


    //this creates the contract and stores the owner. it also passes in 3 addresses to be used later during the lifetime of the contract.
    function QCOToken(
        address _stateControl
    , address _whitelistControl
    , address _withdrawControl
    , address _tokenAssignmentControl
    , address _teamControl
    , address _reserves)
    public
    {
        stateControl = _stateControl;
        whitelistControl = _whitelistControl;
        withdrawControl = _withdrawControl;
        tokenAssignmentControl = _tokenAssignmentControl;
        moveToState(States.Initial);
        endBlock = 0;
        ETH_QCO = 0;
        totalSupply = maxTotalSupply;
        soldTokens = 0;
        Bonus.initBonus(bonusData);
        teamWallet = address(new QravityTeamTimelock(this, _teamControl));

        reserves = _reserves;
        balances[reserves] = totalSupply;
        Mint(reserves, totalSupply);
        Transfer(0x0, reserves, totalSupply);
    }

    event Whitelisted(address addr);

    event StateTransition(States oldState, States newState);

    modifier onlyWhitelist() {
        require(msg.sender == whitelistControl);
        _;
    }

    modifier onlyStateControl() {
        require(msg.sender == stateControl);
        _;
    }

    modifier onlyTokenAssignmentControl() {
        require(msg.sender == tokenAssignmentControl);
        _;
    }

    modifier onlyWithdraw() {
        require(msg.sender == withdrawControl);
        _;
    }

    modifier requireState(States _requiredState) {
        require(state == _requiredState);
        _;
    }

    /**
    BEGIN ICO functions
    */

    //this is the main funding function, it updates the balances of tokens during the ICO.
    //no particular incentive schemes have been implemented here
    //it is only accessible during the "ICO" phase.
    function() payable
    public
    requireState(States.Ico)
    {
        require(whitelist[msg.sender] == true);
        require(msg.value > 0);
        // We have reports that some wallet contracts may end up sending a single null-byte.
        // Still reject calls of unknown functions, which are always at least 4 bytes of data.
        require(msg.data.length < 4);
        require(block.number < endBlock);

        uint256 soldToTuserWithBonus = calcBonus(msg.value);

        issueTokensToUser(msg.sender, soldToTuserWithBonus);
        ethPossibleRefunds[msg.sender] = ethPossibleRefunds[msg.sender].add(msg.value);
    }

    function issueTokensToUser(address beneficiary, uint256 amount)
    internal
    {
        uint256 soldTokensAfterInvestment = soldTokens.add(amount);
        require(soldTokensAfterInvestment <= maxTotalSupply.mul(percentForSale).div(100));

        balances[beneficiary] = balances[beneficiary].add(amount);
        balances[reserves] = balances[reserves].sub(amount);
        soldTokens = soldTokensAfterInvestment;
        Transfer(reserves, beneficiary, amount);
    }

    function getCurrentBonusFactor()
    public view
    returns (uint256 factor)
    {
        return Bonus.getBonusFactor(now, bonusData);
    }

    function getNextCutoffTime()
    public view returns (uint timestamp)
    {
        return Bonus.getFollowingCutoffTime(now, bonusData);
    }

    function calcBonus(uint256 weiAmount)
    constant
    public
    returns (uint256 resultingTokens)
    {
        uint256 basisTokens = weiAmount.mul(ETH_QCO);
        //percentages are integer numbers as per mill (promille) so we can accurately calculate 0.5% = 5. 100% = 1000
        uint256 perMillBonus = getCurrentBonusFactor();
        //100% + bonus % times original amount divided by 100%.
        return basisTokens.mul(per_mill + perMillBonus).div(per_mill);
    }

    uint256 constant per_mill = 1000;


    function moveToState(States _newState)
    internal
    {
        StateTransition(state, _newState);
        state = _newState;
    }
    // ICO contract configuration function
    // new_ETH_QCO is the new rate of ETH in QCO to use when no bonus applies
    // newEndBlock is the absolute block number at which the ICO must stop. It must be set after now + silence period.
    function updateEthICOVariables(uint256 _new_ETH_QCO, uint256 _newEndBlock)
    public
    onlyStateControl
    {
        require(state == States.Initial || state == States.ValuationSet);
        require(_new_ETH_QCO > 0);
        require(block.number < _newEndBlock);
        endBlock = _newEndBlock;
        // initial conversion rate of ETH_QCO set now, this is used during the Ico phase.
        ETH_QCO = _new_ETH_QCO;
        moveToState(States.ValuationSet);
    }

    function startICO()
    public
    onlyStateControl
    requireState(States.ValuationSet)
    {
        require(block.number < endBlock);
        moveToState(States.Ico);
    }

    function addPresaleAmount(address beneficiary, uint256 amount)
    public
    onlyTokenAssignmentControl
    {
        require(state == States.ValuationSet || state == States.Ico);
        issueTokensToUser(beneficiary, amount);
    }


    function endICO()
    public
    onlyStateControl
    requireState(States.Ico)
    {
        burnAndFinish();
        moveToState(States.Operational);
    }

    function anyoneEndICO()
    public
    requireState(States.Ico)
    {
        require(block.number > endBlock);
        burnAndFinish();
        moveToState(States.Operational);
    }

    function burnAndFinish()
    internal
    {
        totalSupply = soldTokens.mul(100).div(percentForSale);

        uint256 teamAmount = totalSupply.mul(22).div(100);
        balances[teamWallet] = teamAmount;
        Transfer(reserves, teamWallet, teamAmount);

        uint256 reservesAmount = totalSupply.sub(soldTokens).sub(teamAmount);
        // Burn all tokens over the target amount.
        Transfer(reserves, 0x0, balances[reserves].sub(reservesAmount).sub(teamAmount));
        balances[reserves] = reservesAmount;

        mintingFinished = true;
        MintFinished();
    }

    function addToWhitelist(address _whitelisted)
    public
    onlyWhitelist
        //    requireState(States.Ico)
    {
        whitelist[_whitelisted] = true;
        Whitelisted(_whitelisted);
    }


    //emergency pause for the ICO
    function pause()
    public
    onlyStateControl
    requireState(States.Ico)
    {
        moveToState(States.Paused);
    }

    //in case we want to completely abort
    function abort()
    public
    onlyStateControl
    requireState(States.Paused)
    {
        moveToState(States.Aborted);
    }

    //un-pause
    function resumeICO()
    public
    onlyStateControl
    requireState(States.Paused)
    {
        moveToState(States.Ico);
    }

    //in case of a failed/aborted ICO every investor can get back their money
    function requestRefund()
    public
    requireState(States.Aborted)
    {
        require(ethPossibleRefunds[msg.sender] > 0);
        //there is no need for updateAccount(msg.sender) since the token never became active.
        uint256 payout = ethPossibleRefunds[msg.sender];
        //reverse calculate the amount to pay out
        ethPossibleRefunds[msg.sender] = 0;
        msg.sender.transfer(payout);
    }

    //after the ICO has run its course, the withdraw account can drain funds bit-by-bit as needed.
    function requestPayout(uint _amount)
    public
    onlyWithdraw //very important!
    requireState(States.Operational)
    {
        msg.sender.transfer(_amount);
    }

    //if this contract gets a balance in some other ERC20 contract - or even iself - then we can rescue it.
    function rescueToken(ERC20Basic _foreignToken, address _to)
    public
    onlyTokenAssignmentControl
    {
        _foreignToken.transfer(_to, _foreignToken.balanceOf(this));
    }
    /**
    END ICO functions
    */

    /**
    BEGIN ERC20 functions
    */
    function transfer(address _to, uint256 _value)
    public
    requireState(States.Operational)
    returns (bool success) {
        return super.transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint256 _value)
    public
    requireState(States.Operational)
    returns (bool success) {
        return super.transferFrom(_from, _to, _value);
    }

    /**
    END ERC20 functions
    */
}
