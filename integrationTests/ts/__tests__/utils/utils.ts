// eslint-disable-next-line import/no-extraneous-dependencies
import { expect } from "chai";
import { Keypair } from "maci-domainobjs";

import { arch } from "os";

import type { TallyData } from "maci-cli";

import { defaultVote } from "./constants";
import { Subsidy, IVote, IBriber } from "./interfaces";
import { UserCommand } from "./user";

/**
 * Test utility to generate vote objects for integrationt ests
 * @param userIndex - the index of the user
 * @param voteIndex - the index of the vote
 * @param numVotesPerUser - the amount of votes per user
 * @param votes - the votes object
 * @param bribers - the bribers votes
 * @returns
 */
const getTestVoteValues = (
  userIndex: number,
  voteIndex: number,
  numVotesPerUser: number,
  votes?: IVote[][],
  bribers?: IBriber[],
) => {
  // check if we have specific votes
  const useVotes = votes && userIndex in votes;
  let { voteOptionIndex } = defaultVote;
  let { voteWeight } = defaultVote;
  let valid = true;

  // if we have bribers
  if (bribers && userIndex in bribers) {
    if (!(bribers[userIndex].voteOptionIndices.length === numVotesPerUser)) {
      throw new Error("failed generating user commands: more bribes than votes set per user");
    }

    // if we were provided specific votes
    if (useVotes) {
      if (bribers[userIndex].voteOptionIndices[voteIndex] !== votes[userIndex][voteIndex].voteOptionIndex) {
        throw new Error(
          "failed generating user commands: conflict between bribers voteOptionIndex and the one set by voters",
        );
      }
    }
    voteOptionIndex = bribers[userIndex].voteOptionIndices[voteIndex];
  } else if (useVotes) {
    voteOptionIndex = votes[userIndex][voteIndex].voteOptionIndex;
  }

  if (useVotes) {
    voteWeight = votes[userIndex][voteIndex].voteWeight;
    valid = votes[userIndex][voteIndex].valid;
  }

  return { voteOptionIndex, voteWeight, valid };
};

/**
 * Generate a list of user commands for integration tests
 * @param numUsers - the number of users
 * @param numVotesPerUser - the number of votes per user
 * @param bribers - the number of bribers
 * @param presetVotes - the preset votes if any
 * @returns an array of UserCommand objects
 */
export const genTestUserCommands = (
  numUsers: number,
  numVotesPerUser: number,
  bribers?: IBriber[],
  presetVotes?: IVote[][],
): UserCommand[] => {
  const usersCommands: UserCommand[] = [];
  for (let i = 0; i < numUsers; i += 1) {
    const userKeypair = new Keypair();
    const votes: IVote[] = [];

    for (let j = 0; j < numVotesPerUser; j += 1) {
      const { voteOptionIndex, voteWeight, valid } = getTestVoteValues(i, j, numVotesPerUser, presetVotes, bribers);
      const vote = {
        voteOptionIndex,
        voteWeight,
        nonce: j + 1,
        valid,
      };

      votes.push(vote);
    }

    const userCommand = new UserCommand(
      userKeypair,
      votes,
      BigInt(defaultVote.maxVoteWeight),
      BigInt(defaultVote.nonce),
    );
    usersCommands.push(userCommand);
  }

  return usersCommands;
};

/**
 * Assertion function to validate that the tally results are as expected
 * @param maxMessages - the max number of messages
 * @param expectedTally - the expected tally values
 * @param expectedPerVOSpentVoiceCredits - the expected per VO spent voice credits
 * @param expectedTotalSpentVoiceCredits - the expected total spent voice credits
 * @param tallyFile the tally file itself as an object
 */
export const expectTally = (
  maxMessages: number,
  expectedTally: number[],
  expectedPerVOSpentVoiceCredits: number[],
  expectedTotalSpentVoiceCredits: number,
  tallyFile: TallyData,
): void => {
  const genTally = Array(maxMessages).fill("0");
  const genPerVOSpentVoiceCredits = Array(maxMessages).fill("0");

  expectedTally.forEach((voteWeight, voteOption) => {
    if (voteWeight !== 0) {
      genTally[voteOption] = voteWeight.toString();
    }
  });

  expectedPerVOSpentVoiceCredits.forEach((spentCredit, index) => {
    if (spentCredit !== 0) {
      genPerVOSpentVoiceCredits[index] = spentCredit.toString();
    }
  });

  expect(tallyFile.results.tally).to.deep.equal(genTally);
  expect(tallyFile.perVOSpentVoiceCredits.tally).to.deep.equal(genPerVOSpentVoiceCredits);
  expect(tallyFile.totalSpentVoiceCredits.spent).to.eq(expectedTotalSpentVoiceCredits.toString());
};

/**
 * Assertion function to ensure that the subsidy results are as expected
 * @param maxMessages - the max number of messages
 * @param expectedSubsidy - the expected subsidy values
 * @param SubsidyFile - the subsidy file itself as an object
 */
export const expectSubsidy = (maxMessages: number, expectedSubsidy: number[], subsidyFile: Subsidy): void => {
  const genSubsidy = Array(maxMessages).fill("0");

  expectedSubsidy.forEach((value, index) => {
    if (value !== 0) {
      genSubsidy[index] = value.toString();
    }
  });

  expect(subsidyFile.results.subsidy).to.deep.equal(genSubsidy);
};

/**
 * Stop the current thread for x seconds
 * @param ms - the number of ms to sleep for
 */
export const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Check whether we are running on an arm chip
 * @returns whether we are running on an arm chip
 */
export const isArm = (): boolean => arch().includes("arm");