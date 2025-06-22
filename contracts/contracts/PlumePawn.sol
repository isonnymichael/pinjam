// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PlumePawn is Ownable, ReentrancyGuard {
    IERC20 public immutable pUSD;

    uint256 public totalLiquidity;
    uint256 public totalBorrowed;
    uint256 public LTV = 70; // Loan-to-Value ratio in percentage
    uint256 public APR = 12;  // APR ratio in percentage
    uint constant SECONDS_IN_YEAR = 365 * 24 * 60 * 60; // For APR calculation
    uint256 public platformDepositFeeBP = 25; // 0.25%
    uint256 public platformRepaymentFeeBP = 200; // 2%
    uint256 public totalPlatformFeesCollected;

    struct InterestRate {
        uint256 duration;
        uint256 rate;
    }

    InterestRate[] public interestRates;

    struct Loan {
        address borrower;
        uint256 loanId;
        address collateralToken;
        uint256 collateralAmount;
        uint256 amount;
        uint256 repayAmount;
        uint256 feeAmount;
        uint256 dueDate;
        bool repaid;
        bool overdue;
    }

    Loan[] public loans;
    mapping(address => uint256[]) public userLoans;

    struct DepositInfo {
        uint256 depositId;
        uint256 amount;
        uint256 feeAmount;
        uint256 apr;
        uint256 depositTimestamp;
        uint256 unclaimedReward;
        uint256 lastRewardCalculation;
        bool withdrawn;
    }

    DepositInfo[] public allDeposits;
    mapping(address => uint256[]) public userDeposits;

    event LiquidityAdded(address indexed provider, uint256 amount, uint256 feeAmount);
    event LiquidityWithdrawn(address indexed owner, uint256 amount, uint256 reward);
    event LoanRequested(uint256 indexed loanId, address indexed borrower, address collateralToken, uint256 collateralAmount, uint256 amount);
    event LoanRepaid(uint256 indexed loanId, uint256 feeAmount);
    event LTVUpdated(uint256 newLTV);
    event APRUpdated(uint256 newApr);
    event InterestRateUpdated(uint256 duration, uint256 newRate);
    event PlatformFeeWithdrawn(uint256 amount);

    constructor(address _pUSD) Ownable(msg.sender) {
        require(_pUSD != address(0), "Invalid pUSD address");
        pUSD = IERC20(_pUSD);

        interestRates.push(InterestRate(30 days, 9));
        interestRates.push(InterestRate(90 days, 12));
        interestRates.push(InterestRate(180 days, 15));
    }

    function setLTV(uint256 newLTV) external onlyOwner {
        require(newLTV > 0 && newLTV <= 100, "Invalid LTV");
        LTV = newLTV;
        emit LTVUpdated(newLTV);
    }

    function setAPR(uint256 newApr) external onlyOwner {
        require(newApr > 0, "Invalid APR");
        APR = newApr;
        emit APRUpdated(newApr);
    }

    function setPlatformFees(uint256 depositFeeBP, uint256 repaymentFeeBP) external onlyOwner {
        require(depositFeeBP <= 500, "Max 5%");
        require(repaymentFeeBP <= 2000, "Max 20%");
        platformDepositFeeBP = depositFeeBP;
        platformRepaymentFeeBP = repaymentFeeBP;
    }

    function setInterestRate(uint256 duration, uint256 rate) external onlyOwner {
        require(rate > 0, "Invalid rate");
        bool updated = false;
        for (uint256 i = 0; i < interestRates.length; i++) {
            if (interestRates[i].duration == duration) {
                interestRates[i].rate = rate;
                updated = true;
                break;
            }
        }
        if (!updated) {
            interestRates.push(InterestRate(duration, rate));
        }
        emit InterestRateUpdated(duration, rate);
    }

    function getInterestRate(uint256 duration) public view returns (uint256) {
        for (uint256 i = 0; i < interestRates.length; i++) {
            if (interestRates[i].duration == duration) {
                return interestRates[i].rate;
            }
        }
        revert("Duration not supported");
    }

    function getAllDurations() external view returns (uint256[] memory) {
        uint256[] memory durations = new uint256[](interestRates.length);
        for (uint256 i = 0; i < interestRates.length; i++) {
            durations[i] = interestRates[i].duration;
        }
        return durations;
    }

    function addLiquidity(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");

        uint256 feeAmount = (amount * platformDepositFeeBP) / 10000;
        uint256 depositAmount = amount - feeAmount;

        require(pUSD.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        totalPlatformFeesCollected += feeAmount;

        uint256 depositId = allDeposits.length;

        allDeposits.push(DepositInfo({
            depositId: depositId,
            amount: depositAmount,
            feeAmount: feeAmount,
            apr: APR,
            depositTimestamp: block.timestamp,
            unclaimedReward: 0,
            lastRewardCalculation: block.timestamp,
            withdrawn: false
        }));

        userDeposits[msg.sender].push(depositId);
        totalLiquidity += depositAmount;
        emit LiquidityAdded(msg.sender, depositAmount, feeAmount);
    }

    function withdrawLiquidity(uint256 depositId) external nonReentrant {
        require(depositId < allDeposits.length, "Invalid deposit ID");
        DepositInfo storage deposit = allDeposits[depositId];
        require(!deposit.withdrawn, "Already withdrawn");

        _updateReward(deposit);

        uint256 totalAmount = deposit.amount + deposit.unclaimedReward;
        require(totalAmount <= totalLiquidity, "Insufficient liquidity");

        require(pUSD.transfer(msg.sender, totalAmount), "Transfer failed");

        deposit.withdrawn = true;
        totalLiquidity -= totalAmount;

        emit LiquidityWithdrawn(msg.sender, deposit.amount, deposit.unclaimedReward);
    }

    function _updateReward(DepositInfo storage deposit) internal {
        uint256 timeElapsed = block.timestamp - deposit.lastRewardCalculation;
        if (timeElapsed > 0) {
            uint256 additionalReward = (deposit.amount * deposit.apr * timeElapsed) / (SECONDS_IN_YEAR * 100);
            deposit.unclaimedReward += additionalReward;
            deposit.lastRewardCalculation = block.timestamp;
        }
    }

    function getUnclaimedReward(uint256 depositId) public view returns (uint256) {
        require(depositId < allDeposits.length, "Invalid deposit ID");
        DepositInfo storage deposit = allDeposits[depositId];
        if (deposit.withdrawn) return 0;

        uint256 timeElapsed = block.timestamp - deposit.lastRewardCalculation;
        uint256 additionalReward = (deposit.amount * deposit.apr * timeElapsed) / (SECONDS_IN_YEAR * 100);
        return deposit.unclaimedReward + additionalReward;
    }

    function requestLoan(address collateralToken, uint256 collateralAmount, uint256 loanAmount, uint256 duration) external nonReentrant {
        require(collateralAmount > 0, "Invalid collateral amount");
        require(collateralToken != address(0), "Invalid token");

        IERC20 token = IERC20(collateralToken);
        require(token.transferFrom(msg.sender, address(this), collateralAmount), "Collateral transfer failed");

        uint256 interest = getInterestRate(duration);
        require(totalLiquidity >= loanAmount, "Insufficient liquidity");

        uint256 repayAmount = loanAmount + ((loanAmount * interest) / 100);
        uint256 feeAmount = (repayAmount * platformRepaymentFeeBP) / 10000;

        require(pUSD.transfer(msg.sender, loanAmount), "Loan transfer failed");

        uint256 loanId = loans.length;
        loans.push(Loan({
            borrower: msg.sender,
            loanId: loanId,
            collateralToken: collateralToken,
            collateralAmount: collateralAmount,
            amount: loanAmount,
            repayAmount: repayAmount,
            feeAmount: feeAmount,
            dueDate: block.timestamp + duration,
            repaid: false,
            overdue: false
        }));

        userLoans[msg.sender].push(loanId);
        totalBorrowed += loanAmount;
        totalLiquidity -= loanAmount;

        emit LoanRequested(loanId, msg.sender, collateralToken, collateralAmount, loanAmount);
    }

    function repayLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(msg.sender == loan.borrower, "Not borrower");
        require(!loan.repaid, "Loan resolved");
        require(block.timestamp <= loan.dueDate, "Loan overdue");

        require(pUSD.transferFrom(msg.sender, address(this), loan.repayAmount), "Repayment failed");

        totalPlatformFeesCollected += loan.feeAmount;

        IERC20(loan.collateralToken).transfer(msg.sender, loan.collateralAmount);

        loan.repaid = true;
        totalBorrowed -= loan.amount;
        totalLiquidity += (loan.repayAmount - loan.feeAmount);

        emit LoanRepaid(loanId, loan.feeAmount);
    }

    function withdrawPlatformFees() external onlyOwner nonReentrant {
        require(totalPlatformFeesCollected > 0, "No fees to withdraw");
        uint256 amount = totalPlatformFeesCollected;
        totalPlatformFeesCollected = 0;

        require(pUSD.transfer(msg.sender, amount), "Transfer failed");
        emit PlatformFeeWithdrawn(amount);
    }

    function getLoansByUser(address user) external view returns (Loan[] memory) {
        uint256[] memory ids = userLoans[user];
        Loan[] memory result = new Loan[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            Loan storage loan = loans[ids[i]];
            result[i] = Loan({
                borrower: loan.borrower,
                loanId: loan.loanId,
                collateralToken: loan.collateralToken,
                collateralAmount: loan.collateralAmount,
                amount: loan.amount,
                repayAmount: loan.repayAmount,
                feeAmount: loan.feeAmount,
                dueDate: loan.dueDate,
                repaid: loan.repaid,
                overdue: !loan.repaid && block.timestamp > loan.dueDate
            });
        }
        return result;
    }

    function getDepositsByUser(address user) external view returns (DepositInfo[] memory) {
        uint256[] memory ids = userDeposits[user];
        DepositInfo[] memory result = new DepositInfo[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            DepositInfo memory deposit = allDeposits[ids[i]];
            if (!deposit.withdrawn) {
                uint256 timeElapsed = block.timestamp - deposit.lastRewardCalculation;
                uint256 additionalReward = (deposit.amount * deposit.apr * timeElapsed) / (SECONDS_IN_YEAR * 100);
                deposit.unclaimedReward += additionalReward;
            }
            result[i] = deposit;
        }
        return result;
    }
}
