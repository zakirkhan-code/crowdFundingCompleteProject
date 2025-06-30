// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CrowdFunding {
    struct Campaign {
        uint256 id;
        address payable owner;
        string title;
        string description;
        uint256 target;
        uint256 deadline;
        uint256 amountCollected;
        string image;
        address[] donators;
        uint256[] donations;
        bool withdrawn;
    }

    mapping(uint256 => Campaign) public campaigns;
    uint256 public numberOfCampaigns = 0;

    // Events
    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed owner,
        string title,
        uint256 target,
        uint256 deadline
    );

    event DonationReceived(
        uint256 indexed campaignId,
        address indexed donator,
        uint256 amount
    );

    event FundsWithdrawn(
        uint256 indexed campaignId,
        address indexed owner,
        uint256 amount
    );

    // Create a new campaign
    function createCampaign(
        address _owner,
        string memory _title,
        string memory _description,
        uint256 _target,
        uint256 _deadline,
        string memory _image
    ) public returns (uint256) {
        require(_deadline > block.timestamp, "Deadline must be in the future");
        require(_target > 0, "Target amount must be greater than 0");

        Campaign storage campaign = campaigns[numberOfCampaigns];

        campaign.id = numberOfCampaigns;
        campaign.owner = payable(_owner);
        campaign.title = _title;
        campaign.description = _description;
        campaign.target = _target;
        campaign.deadline = _deadline;
        campaign.amountCollected = 0;
        campaign.image = _image;
        campaign.withdrawn = false;

        numberOfCampaigns++;

        emit CampaignCreated(
            numberOfCampaigns - 1,
            _owner,
            _title,
            _target,
            _deadline
        );

        return numberOfCampaigns - 1;
    }

    // Donate to a campaign
    function donateToCampaign(uint256 _id) public payable {
        require(_id < numberOfCampaigns, "Campaign does not exist");
        require(msg.value > 0, "Donation amount must be greater than 0");
        require(
            block.timestamp < campaigns[_id].deadline,
            "Campaign deadline has passed"
        );

        Campaign storage campaign = campaigns[_id];

        campaign.donators.push(msg.sender);
        campaign.donations.push(msg.value);
        campaign.amountCollected += msg.value;

        emit DonationReceived(_id, msg.sender, msg.value);
    }

    // Get donators for a campaign
    function getDonators(uint256 _id)
        public
        view
        returns (address[] memory, uint256[] memory)
    {
        require(_id < numberOfCampaigns, "Campaign does not exist");
        return (campaigns[_id].donators, campaigns[_id].donations);
    }

    // Get all campaigns
    function getCampaigns() public view returns (Campaign[] memory) {
        Campaign[] memory allCampaigns = new Campaign[](numberOfCampaigns);

        for (uint256 i = 0; i < numberOfCampaigns; i++) {
            allCampaigns[i] = campaigns[i];
        }

        return allCampaigns;
    }

    // Withdraw funds (only campaign owner)
    function withdrawFunds(uint256 _id) public {
        require(_id < numberOfCampaigns, "Campaign does not exist");
        Campaign storage campaign = campaigns[_id];
        
        require(
            msg.sender == campaign.owner,
            "Only campaign owner can withdraw"
        );
        require(!campaign.withdrawn, "Funds already withdrawn");
        require(
            campaign.amountCollected >= campaign.target,
            "Target not reached"
        );
        require(
            block.timestamp >= campaign.deadline,
            "Campaign still active"
        );

        campaign.withdrawn = true;
        campaign.owner.transfer(campaign.amountCollected);

        emit FundsWithdrawn(_id, campaign.owner, campaign.amountCollected);
    }

    // Emergency withdraw (if target not reached after deadline)
    function emergencyWithdraw(uint256 _id) public {
        require(_id < numberOfCampaigns, "Campaign does not exist");
        Campaign storage campaign = campaigns[_id];
        
        require(
            msg.sender == campaign.owner,
            "Only campaign owner can withdraw"
        );
        require(!campaign.withdrawn, "Funds already withdrawn");
        require(
            block.timestamp >= campaign.deadline,
            "Campaign still active"
        );

        campaign.withdrawn = true;
        campaign.owner.transfer(campaign.amountCollected);

        emit FundsWithdrawn(_id, campaign.owner, campaign.amountCollected);
    }
}