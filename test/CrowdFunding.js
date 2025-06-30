const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrowdFunding", function () {
  let crowdFunding;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const CrowdFunding = await ethers.getContractFactory("CrowdFunding");
    crowdFunding = await CrowdFunding.deploy();
    await crowdFunding.waitForDeployment();
  });

  describe("Campaign Creation", function () {
    it("Should create a campaign successfully", async function () {
      const title = "Help Build School";
      const description = "Building a school in rural area";
      const target = ethers.parseEther("1");
      const deadline = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
      const image = "https://example.com/image.jpg";

      await crowdFunding.createCampaign(
        owner.address,
        title,
        description,
        target,
        deadline,
        image
      );

      const campaign = await crowdFunding.campaigns(0);
      expect(campaign.owner).to.equal(owner.address);
      expect(campaign.title).to.equal(title);
      expect(campaign.target).to.equal(target);
    });
  });

  describe("Donations", function () {
    it("Should accept donations", async function () {
      const title = "Help Build School";
      const description = "Building a school in rural area";
      const target = ethers.parseEther("1");
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      const image = "https://example.com/image.jpg";

      await crowdFunding.createCampaign(
        owner.address,
        title,
        description,
        target,
        deadline,
        image
      );

      const donationAmount = ethers.parseEther("0.1");
      await crowdFunding.connect(addr1).donateToCampaign(0, {
        value: donationAmount,
      });

      const campaign = await crowdFunding.campaigns(0);
      expect(campaign.amountCollected).to.equal(donationAmount);
    });
  });
});
