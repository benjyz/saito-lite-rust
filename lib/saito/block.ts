import * as JSON from "json-bigint";
import Slip, { SlipType } from "./slip";
import Transaction, { HOP_SIZE, SLIP_SIZE, TRANSACTION_SIZE, TransactionType } from "./transaction";
import { Saito } from "../../apps/core";
import Goldenticket from "./goldenticket";
import GoldenTicket from "./goldenticket";
import UtxoSet from "./utxoset";
import Hop from "./hop";

const BLOCK_HEADER_SIZE = 301;

export enum BlockType {
  Ghost = 0,
  Header = 1,
  Pruned = 2,
  Full = 3,
}

class Block {
  public app: Saito;
  public block = {
    id: BigInt(0),
    timestamp: 0,
    previous_block_hash: "",
    merkle: "",
    creator: "",
    burnfee: BigInt(0),
    difficulty: 0,
    treasury: BigInt(0),
    staking_treasury: BigInt(0),
    signature: "",
    avg_income: BigInt(0),
    avg_variance: BigInt(0),
    avg_atr_income: BigInt(0),
    avg_atr_variance: BigInt(0),
  };
  public lc: boolean;
  public force: boolean;
  public transactions: Array<Transaction>;
  public block_type: BlockType;
  public hash: string;
  public prehash: string;
  public filename: string;
  public total_fees: bigint;
  public total_work: bigint;
  public routing_work_for_creator: bigint;
  public is_valid: boolean;
  public has_golden_ticket: boolean;
  public has_fee_transaction: boolean;
  public ft_idx: number;
  public gt_idx: number;
  public has_issuance_transaction: boolean;
  public has_hashmap_of_slips_spent_this_block: boolean;
  public slips_spent_this_block: Map<string, number>;
  public rebroadcast_hash: string;
  public total_rebroadcast_slips: number;
  public total_rebroadcast_nolan: bigint;
  public callbacks: any;
  public callbackTxs: any;
  public confirmations: any;
  public add_transaction: any;
  public created_hashmap_of_slips_spent_this_block: boolean;
  public bundling_active: boolean;
  public fee_transaction_idx: number;
  public golden_ticket_idx: number;
  public issuance_transaction_idx: number;
  public txs_hmap: Map<string, number>;
  public txs_hmap_generated: boolean;
  public has_examined_block: boolean;

  constructor(app: Saito) {
    this.app = app;

    //
    // consensus variables
    //

    this.lc = false;
    this.force = false; // set to true if "force" loaded -- used to avoid duplicating callbacks

    this.transactions = new Array<Transaction>();

    this.block_type = BlockType.Full;
    this.hash = "";
    this.prehash = "";
    this.filename = ""; // set when saved

    this.total_fees = BigInt(0);
    this.total_work = BigInt(0);
    this.routing_work_for_creator = BigInt(0);

    this.is_valid = true;
    this.has_golden_ticket = false;
    this.has_fee_transaction = false;
    this.ft_idx = 0;
    this.gt_idx = 0;
    this.has_issuance_transaction = false;
    this.has_hashmap_of_slips_spent_this_block = false;
    this.slips_spent_this_block = new Map<string, number>();
    this.rebroadcast_hash = "";
    this.total_rebroadcast_slips = 0;
    this.total_rebroadcast_nolan = BigInt(0);

    this.txs_hmap = new Map<string, number>();
    this.txs_hmap_generated = false;

    this.callbacks = [];
    this.callbackTxs = [];
    this.confirmations = -1; // set to +1 when we start callbacks

    this.has_examined_block = false;
  }

  affixCallbacks() {
    for (let z = 0; z < this.transactions.length; z++) {
      if (this.transactions[z].transaction.type === TransactionType.Normal) {
        const txmsg = this.transactions[z].returnMessage();
        // console.log("txmsg length: ", txmsg ? JSON.stringify(txmsg).length : txmsg);
        this.app.modules.affixCallbacks(
          this.transactions[z],
          z,
          txmsg,
          this.callbacks,
          this.callbackTxs
        );
      }
    }
  }

  // called when a block is deleted from the chain for good
  deleteBlock(utxoset: UtxoSet) {
    // remove from disk, etc.
  }

  /**
   * deserialize block
   * @param {array} buffer -
   * @returns {Block}
   */
  deserialize(buffer?) {
    //console.debug("deserializing block");
    const transactions_length = this.app.binary.u32FromBytes(buffer.slice(0, 4));

    this.block.id = this.app.binary.u64FromBytes(buffer.slice(4, 12)); // TODO : fix this to support correct ranges.
    this.block.timestamp = parseInt(this.app.binary.u64FromBytes(buffer.slice(12, 20)).toString());
    this.block.previous_block_hash = Buffer.from(buffer.slice(20, 52)).toString("hex");
    this.block.creator = this.app.crypto.toBase58(
      Buffer.from(buffer.slice(52, 85)).toString("hex")
    );
    this.block.merkle = Buffer.from(buffer.slice(85, 117)).toString("hex");
    this.block.signature = Buffer.from(buffer.slice(117, 181)).toString("hex");

    this.block.treasury = this.app.binary.u128FromBytes(buffer.slice(181, 197));
    this.block.staking_treasury = BigInt(this.app.binary.u128FromBytes(buffer.slice(197, 213)));
    this.block.burnfee = BigInt(this.app.binary.u128FromBytes(buffer.slice(213, 229)));

    this.block.difficulty = parseInt(
      this.app.binary.u64FromBytes(buffer.slice(229, 237)).toString()
    );

    this.block.avg_income = BigInt(this.app.binary.u128FromBytes(buffer.slice(237, 253)));
    this.block.avg_variance = BigInt(this.app.binary.u128FromBytes(buffer.slice(253, 269)));
    this.block.avg_atr_income = BigInt(this.app.binary.u128FromBytes(buffer.slice(269, 285)));
    this.block.avg_atr_variance = BigInt(this.app.binary.u128FromBytes(buffer.slice(285, 301)));

    let start_of_transaction_data = BLOCK_HEADER_SIZE;

    //
    // TODO - there is a cleaner way to do this
    //
    if (
      this.block.previous_block_hash ===
      "0000000000000000000000000000000000000000000000000000000000000000"
    ) {
      this.block.previous_block_hash = "";
    }
    if (this.block.merkle === "0000000000000000000000000000000000000000000000000000000000000000") {
      this.block.merkle = "";
    }
    if (
      this.block.creator === "000000000000000000000000000000000000000000000000000000000000000000"
    ) {
      this.block.creator = "";
    }
    if (
      this.block.signature ===
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    ) {
      this.block.signature = "";
    }
    // console.debug(`block.deserialize tx length = ${transactions_length}`);
    for (let i = 0; i < transactions_length; i++) {
      const inputs_len = this.app.binary.u32FromBytes(
        buffer.slice(start_of_transaction_data, start_of_transaction_data + 4)
      );
      const outputs_len = this.app.binary.u32FromBytes(
        buffer.slice(start_of_transaction_data + 4, start_of_transaction_data + 8)
      );
      const message_len = this.app.binary.u32FromBytes(
        buffer.slice(start_of_transaction_data + 8, start_of_transaction_data + 12)
      );
      const path_len = this.app.binary.u32FromBytes(
        buffer.slice(start_of_transaction_data + 12, start_of_transaction_data + 16)
      );
      const end_of_transaction_data =
        start_of_transaction_data +
        TRANSACTION_SIZE +
        (inputs_len + outputs_len) * SLIP_SIZE +
        message_len +
        path_len * HOP_SIZE;

      const transaction = new Transaction();
      transaction.deserialize(this.app, buffer, start_of_transaction_data);
      this.transactions.push(transaction);
      start_of_transaction_data = end_of_transaction_data;
    }
    // console.debug("block deserialized");
  }

  //
  // if the block is not at the proper type, try to downgrade it by removing elements
  // that take up significant amounts of data / memory. if this is possible return
  // true, otherwise return false.
  //
  async downgradeBlockToBlockType(block_type) {
    if (this.isType(block_type)) {
      return true;
    }

    if (block_type === "Pruned") {
      this.block_type = BlockType.Pruned;
      this.transactions = [];
      //console.debug(`block ${this.returnHash()} type set as pruned`);
      return true;
    }
    return false;
  }

  findWinningRouter(random_number) {
    //
    // find winning nolan
    //
    const x = BigInt("0x" + random_number);

    //
    // fee calculation should be the same used in block when
    // generating the fee transaction.
    //
    const y = BigInt(this.returnFeesTotal());

    //
    // if there are no fees, payout to no-one
    //
    if (y === BigInt(0)) {
      return "";
    }

    const winning_nolan = x % y;

    //
    // winning tx is either fee-paying or ATR transaction
    //
    let winning_tx = this.transactions[0];
    for (let i = 0; i < this.transactions.length; i++) {
      // TODO - select correct tx
      //if (this.transactions[i].transaction.work_cumulative > winning_nolan) {
      //   break;
      //}

      winning_tx = this.transactions[i];
    }

    //
    // if winner is atr, take inside TX
    //
    if (winning_tx.transaction.type === TransactionType.ATR) {
      const buffer = winning_tx.returnMessage();
      const winning_tx_placeholder = new Transaction();
      winning_tx_placeholder.deserialize(this.app, buffer, 0);
      winning_tx = winning_tx_placeholder;
    }

    //
    // hash random number to pick routing node
    //
    const rn = this.app.crypto.hash(random_number.toString());

    //
    // and pick from path, if exists
    //
    return winning_tx.returnWinningRoutingNode(rn);
  }

  isType(type) {
    if (type === "Ghost") {
      return this.block_type === BlockType.Ghost;
    }
    if (type === "Pruned") {
      return this.block_type === BlockType.Pruned;
    }
    if (type === "Header") {
      return this.block_type === BlockType.Header;
    }
    if (type === "Full") {
      return this.block_type === BlockType.Full;
    }
  }

  async generateConsensusValues() {
    // console.log("generating consensus values for block : ", this.hash);
    // this is the number of blocks we will recurse backwards to issue the
    // staker payout. if this permits strings of blocks that are less than
    // the theoretical maximum number of golden-ticket free blocks that can
    // be produced then the network will experience deflation.
    //
    const MAX_STAKER_RECURSION = 3; // current block + 2 payouts

    //
    // return obj w/ default values
    //
    const cv: {
      total_rebroadcast_staking_payouts_nolan: bigint;
      staking_treasury: bigint;
      total_fees: bigint;
      gt_num: number;
      avg_income: bigint;
      ft_num: number;
      rebroadcast_hash: string;
      block_payouts: any[];
      avg_atr_income: bigint;
      avg_atr_variance: bigint;
      it_num: number;
      fee_transaction: Transaction | null;
      avg_variance: bigint;
      expected_difficulty: number;
      ft_idx: number;
      total_rebroadcast_slips: number;
      rebroadcasts: Transaction[];
      it_idx: number;
      gt_idx: number;
      nolan_falling_off_chain: bigint;
      total_rebroadcast_fees_nolan: bigint;
      total_rebroadcast_nolan: bigint;
    } = {
      total_fees: BigInt(0),
      ft_num: 0,
      gt_num: 0,
      it_num: 0,
      ft_idx: 0,
      gt_idx: 0,
      it_idx: 0,
      expected_difficulty: 1,
      total_rebroadcast_nolan: BigInt(0),
      total_rebroadcast_fees_nolan: BigInt(0),
      total_rebroadcast_staking_payouts_nolan: BigInt(0),
      total_rebroadcast_slips: 0,
      nolan_falling_off_chain: BigInt(0),
      rebroadcast_hash: "",
      staking_treasury: BigInt(0),
      rebroadcasts: new Array<Transaction>(),
      block_payouts: [],
      fee_transaction: null,
      avg_income: BigInt(0),
      avg_variance: BigInt(0),
      avg_atr_income: BigInt(0),
      avg_atr_variance: BigInt(0),
    };

    //
    // calculate total fees and indices
    //
    for (let i = 0; i < this.transactions.length; i++) {
      try {
        if (!this.transactions[i].isFeeTransaction()) {
          cv.total_fees += this.transactions[i].returnFeesTotal();
        } else {
          cv.ft_num += 1;
          cv.ft_idx = i;
          this.has_fee_transaction = true;
          this.ft_idx = i;
        }
        if (this.transactions[i].isGoldenTicket()) {
          cv.gt_num += 1;
          cv.gt_idx = i;
          this.has_golden_ticket = true;
          this.gt_idx = i;
        }
        if (this.transactions[i].isIssuanceTransaction()) {
          cv.it_num += 1;
          cv.it_idx = i;
          this.has_issuance_transaction = true;
        }
      } catch (err) {
        console.error(err);
        console.error("ERROR W/: ", this.transactions[i]);
      }
    }

    // console.log(`${typeof this.block.id} > ${typeof this.app.blockchain.returnGenesisPeriod()} + ${typeof this.app.blockchain.genesis_period}`);

    // calculate automatic transaction rebroadcasts / ATR / atr
    if (this.block.id > this.app.blockchain.returnGenesisPeriod() + BigInt(1)) {
      const pruned_block_id = this.block.id - this.app.blockchain.returnGenesisPeriod();
      const pruned_block_hash =
        this.app.blockring.returnLongestChainBlockHashByBlockId(pruned_block_id);
      console.log("pruned block id: " + pruned_block_id);
      console.log("pruned block hash: " + pruned_block_hash);
      const pruned_block = await this.app.blockchain.loadBlockAsync(pruned_block_hash);

      //
      // generate metadata should have already loaded this pruned-block into
      // memory with all the transactions that we will need to examine to
      // determine which should be rebroadcast.
      //
      if (pruned_block) {
        // only unspent UTXO eligible
        for (let i = 0; i < pruned_block.transactions.length; i++) {
          const tx = pruned_block.transactions[i];

          for (let k = 0; k < tx.transaction.to.length; k++) {
            const output = tx.transaction.to[k];

            //
            // these need to be calculated dynamically based on the
            // value of the TX and the byte-size of the transaction
            //
            const REBROADCAST_FEE = BigInt(200000000);
            const STAKING_SUBSIDY = BigInt(100000000);
            const UTXO_ADJUSTMENT = REBROADCAST_FEE - STAKING_SUBSIDY;

            //
            // valid means spendable and non-zero
            //
            if (output.validate(this.app)) {
              //
              // TODO - no parse int as numbers potentially too big
              //
              if (output.returnAmount() > UTXO_ADJUSTMENT) {
                cv.total_rebroadcast_nolan += output.returnAmount();
                cv.total_rebroadcast_fees_nolan += REBROADCAST_FEE;
                cv.total_rebroadcast_staking_payouts_nolan += STAKING_SUBSIDY;
                cv.total_rebroadcast_slips += 1;

                //
                // create rebroadcast transaction
                //
                // TODO - floating fee based on previous block average
                //
                const rebroadcast_transaction = new Transaction();
                rebroadcast_transaction.generateRebroadcastTransaction(
                  this.app,
                  output,
                  REBROADCAST_FEE,
                  STAKING_SUBSIDY
                );

                // update cryptographic hash of all ATRs
                cv.rebroadcast_hash = this.app.crypto.hash(
                  Buffer.concat([
                    Buffer.from(cv.rebroadcast_hash, "hex"),
                    rebroadcast_transaction.serializeForSignature(this.app),
                  ])
                );
              } else {
                //
                // rebroadcast dust is either collected into the treasury or
                // distributed as a fee for the next block producer. for now,
                // we will simply distribute it as a fee. we may need to
                // change this if the DUST becomes a significant enough amount
                // each block to reduce consensus security.
                //
                cv.total_rebroadcast_fees_nolan += output.returnAmount();
              }
            }
          }
        }
      }
    }

    //
    // difficulty and fee averages
    //
    const previous_block = await this.app.blockchain.loadBlockAsync(this.block.previous_block_hash);
    if (previous_block) {
      // difficulty depends on previous block
      const difficulty = previous_block.returnDifficulty();

      if (previous_block.hasGoldenTicket() && cv.gt_num === 0) {
        if (difficulty > 0) {
          cv.expected_difficulty = previous_block.returnDifficulty() - 1;
        }
      } else if (previous_block.hasGoldenTicket() && cv.gt_num > 0) {
        cv.expected_difficulty = difficulty + 1;
      } else {
        cv.expected_difficulty = difficulty;
      }

      //
      // average income and variance depends on previous block too
      //
      cv.avg_income = previous_block.block.avg_income;
      cv.avg_variance = previous_block.block.avg_variance;
      cv.avg_atr_income = previous_block.block.avg_atr_income;
      cv.avg_atr_variance = previous_block.block.avg_atr_variance;

      if (previous_block.block.avg_income > cv.total_fees) {
        let adjustment =
          (previous_block.block.avg_income - cv.total_fees) /
          this.app.blockchain.genesis_period;
        if (adjustment > 0) {
          cv.avg_income -= adjustment;
        }
      }
      if (previous_block.block.avg_income < cv.total_fees) {
        let adjustment =
          (cv.total_fees - previous_block.block.avg_income) /
          this.app.blockchain.genesis_period;
        if (adjustment > 0) {
          cv.avg_income += adjustment;
        }
      }

      //
      // average atr income and variance adjusts slowly.
      //
      if (previous_block.block.avg_atr_income > cv.total_rebroadcast_nolan) {
        let adjustment =
          (previous_block.block.avg_atr_income - cv.total_rebroadcast_nolan) /
          this.app.blockchain.genesis_period;
        if (adjustment > 0) {
          cv.avg_atr_income -= adjustment;
        }
      }
      if (previous_block.block.avg_atr_income < cv.total_rebroadcast_nolan) {
        let adjustment =
          (cv.total_rebroadcast_nolan - previous_block.block.avg_atr_income) /
          this.app.blockchain.genesis_period;
        if (adjustment > 0) {
          cv.avg_atr_income += adjustment;
        }
      }
    } else {
      //console.debug("previous block not found");
      //
      // if there is no previous block, the difficulty is not adjusted. validation
      // rules will cause the block to fail unless it is the first block.
      //

      //
      // set average income and variance so non-failure on first block
      // doesn't result in failure calculating avg_income and avg_variance
      // or avg_atr_variance or avg_atr_income.
      //
      cv.avg_income = this.block.avg_income;
      cv.avg_variance = this.block.avg_variance;

      cv.avg_atr_income = this.block.avg_atr_income;
      cv.avg_atr_variance = this.block.avg_atr_variance;
    }

    //
    // calculate payments to miners / routers
    //
    if (cv.gt_num > 0) {
      //console.debug("golden ticket found at index : " + cv.gt_idx);
      const golden_ticket_transaction = this.transactions[cv.gt_idx];
      const gt = this.app.goldenticket.deserializeFromTransaction(golden_ticket_transaction);

      let next_random_number = this.app.crypto.hash(gt.random_hash);
      const miner_publickey = gt.creator;

      // miner payout is fees from previous block, no staking treasury
      if (previous_block) {
        //console.debug("checking fees from previous block : " + previous_block.hash);
        // limit previous block payout to avg income
        let previous_block_payout = previous_block.returnFeesTotal();
        if (
          previous_block_payout > BigInt(Number(previous_block.block.avg_income) * 1.25) &&
          previous_block_payout > 50
        ) {
          previous_block_payout = BigInt(Number(previous_block.block.avg_income) * 1.24);
        }

        const miner_payment = previous_block_payout / BigInt(2);
        const router_payment = previous_block_payout - miner_payment;

        //
        // calculate miner and router payments
        //
        // TODO - remove staker components
        const block_payout = {
          miner: "",
          staker: "",
          router: "",
          miner_payout: BigInt(0),
          staker_payout: BigInt(0),
          router_payout: BigInt(0),
          staking_treasury: BigInt(0),
          staker_slip: null,
          random_number: next_random_number,
        };

        block_payout.router = previous_block.findWinningRouter(next_random_number);
        block_payout.miner = miner_publickey;
        block_payout.miner_payout = miner_payment;
        block_payout.router_payout = router_payment;

        // these two from find_winning_router - 3, 4
        next_random_number = this.app.crypto.hash(next_random_number);
        next_random_number = this.app.crypto.hash(next_random_number);

        // add these payouts to consensus values
        // console.debug("adding block payout : ", block_payout);
        cv.block_payouts.push(block_payout);

        // loop backwards until MAX recursion OR golden ticket
        let cont = 1;
        let loop_idx = 0;
        let did_the_block_before_our_staking_block_have_a_golden_ticket =
          previous_block.hasGoldenTicket();

        //
        // staking block hash is 3 back, pre
        //
        let staking_block_hash = previous_block.returnPreviousBlockHash();

        while (cont === 1) {
          loop_idx += 1;

          //
          // we start with the second block, so once loop_IDX hits the same
          // number as MAX_STAKER_RECURSION we have processed N blocks where
          // N is MAX_STAKER_RECURSION.
          //
          if (loop_idx >= MAX_STAKER_RECURSION) {
            cont = 0;
          } else {
            const staking_block = await this.app.blockchain.loadBlockAsync(staking_block_hash);
            if (staking_block) {
              //
              // in case we need another loop
              //
              staking_block_hash = staking_block.returnPreviousBlockHash();

              if (!did_the_block_before_our_staking_block_have_a_golden_ticket) {
                // update with this block info in case of next loop
                did_the_block_before_our_staking_block_have_a_golden_ticket =
                  staking_block.hasGoldenTicket();

                // calculate staker block payments
                let previous_staking_block_payout = staking_block.returnFeesTotal();
                if (
                  previous_staking_block_payout >
                    BigInt(Number(staking_block.block.avg_income) * 1.25) &&
                  previous_staking_block_payout > 50
                ) {
                  previous_staking_block_payout = BigInt(
                    Number(staking_block.block.avg_income) * 1.24
                  );
                }

                const sp = previous_staking_block_payout / BigInt(2);
                const rp = previous_staking_block_payout - sp;

                const block_payout = {
                  miner: "",
                  staker: "",
                  router: "",
                  miner_payout: BigInt(0),
                  staker_payout: BigInt(0),
                  router_payout: BigInt(0),
                  staking_treasury: BigInt(0),
                  staker_slip: null,
                  random_number: next_random_number,
                };

                block_payout.router = staking_block.findWinningRouter(next_random_number);
                block_payout.router_payout = rp;
                block_payout.staking_treasury = sp;

                // router consumes 2 hashes
                next_random_number = this.app.crypto.hash(next_random_number);
                next_random_number = this.app.crypto.hash(next_random_number);

                // console.debug("adding block payout : ", block_payout);
                cv.block_payouts.push(block_payout);
              }
            }
          }
        }
      }

      //
      // now create fee transaction using the block payouts
      //
      let slip_ordinal = 0;
      const transaction = new Transaction();

      transaction.transaction.type = TransactionType.Fee;

      for (let i = 0; i < cv.block_payouts.length; i++) {
        if (cv.block_payouts[i].miner !== "") {
          const output = new Slip();
          output.add = cv.block_payouts[i].miner;
          output.amt = cv.block_payouts[i].miner_payout;
          output.type = SlipType.MinerOutput;
          output.sid = slip_ordinal;
          transaction.addOutput(output.clone());
          slip_ordinal += 1;
        }
        if (cv.block_payouts[i].router !== "") {
          const output = new Slip();
          output.add = cv.block_payouts[i].router;
          output.amt = cv.block_payouts[i].router_payout;
          output.type = SlipType.RouterOutput;
          output.sid = slip_ordinal;
          transaction.addOutput(output.clone());
          slip_ordinal += 1;
        }
      }

      cv.fee_transaction = transaction;
    } else {
      console.log("no GTs in block");
    }

    //
    // collect destroyed NOLAN and add to treasury
    //
    // if there is no golden ticket AND there is no golden ticket before the MAX
    // blocks we recurse to collect NOLAN we have to add the amount of the unpaid
    // block to the amount of NOLAN that is falling off our chain.
    //
    // this edge-case should be a statistical abnormality that we almost never
    // run into, but it is good to collect the SAITO into a variable that we track
    // so that we can confirm the soundness of monetary policy by monitoring the
    // blockchain.
    //
    if (cv.gt_num === 0) {
      for (let i = 1; i <= MAX_STAKER_RECURSION; i++) {
        if (i >= this.returnId()) {
          break;
        }

        const bid: bigint = this.returnId() - BigInt(i);
        const previous_block_hash = this.app.blockring.returnLongestChainBlockHashByBlockId(bid);
        if (previous_block_hash !== "") {
          const previous_block = await this.app.blockchain.loadBlockAsync(previous_block_hash);
          if (previous_block) {
            if (previous_block.hasGoldenTicket()) {
              break;
            } else {
              //
              // this is the block BEFORE from which we need to collect the nolan due to
              // our iterator starting at 0 for the current block. i.e. if MAX_STAKER_
              // RECURSION is 3, at 3 we are the fourth block back.
              //
              if (i === MAX_STAKER_RECURSION) {
                cv.nolan_falling_off_chain = previous_block.returnFeesTotal();
              }
            }
          }
        }
      }
    }

    return cv;
  }

  async generate(previous_block_hash: string) {
    //
    // fetch consensus values from preceding block
    //
    let previous_block_id = BigInt(0);
    let previous_block_timestamp = 0;
    let previous_block_difficulty = 0;
    let previous_block_burnfee = BigInt(0);
    let previous_block_treasury = BigInt(0);
    let previous_block_staking_treasury = BigInt(0);
    const current_timestamp = new Date().getTime();

    const previous_block = await this.app.blockchain.loadBlockAsync(previous_block_hash);

    if (previous_block) {
      previous_block_id = previous_block.block.id;
      previous_block_burnfee = previous_block.block.burnfee;
      previous_block_timestamp = previous_block.block.timestamp;
      previous_block_difficulty = previous_block.block.difficulty;
      previous_block_treasury = previous_block.block.treasury;
      previous_block_staking_treasury = previous_block.block.staking_treasury;
    }

    const current_burnfee = this.app.burnfee.returnBurnFeeForBlockProducedAtCurrentTimestampInNolan(
      previous_block_burnfee,
      current_timestamp,
      previous_block_timestamp
    );

    //
    // set our values
    //
    this.block.id = previous_block_id + BigInt(1);
    this.block.previous_block_hash = previous_block_hash;
    this.block.burnfee = current_burnfee;
    this.block.timestamp = current_timestamp;
    this.block.difficulty = previous_block_difficulty;

    //
    // swap in transactions
    //
    // note that these variables are submitted attached to the mempool
    // object, so we can hot-swap using pass-by-reference. these
    // modifications change the mempool in real-time.
    //
    this.transactions = this.app.mempool.mempool.transactions;
    this.app.mempool.mempool.transactions = new Array<Transaction>();

    //
    // first block gets issuance
    //
    if (this.block.id === BigInt(1)) {
      let tokens_issued = BigInt(0);
      let slips = this.app.storage.returnTokenSupplySlipsFromDisk();
      let newtx = this.app.wallet.createUnsignedTransaction();
      newtx.transaction.type = TransactionType.Issuance;
      for (let i = 0; i < slips.length; i++) {
        tokens_issued += BigInt(slips[i].amt);
        newtx.transaction.to.push(slips[i]);
      }
      newtx = this.app.wallet.signTransaction(newtx);
      this.transactions.push(newtx);
    }

    //
    // swap in golden ticket
    //
    // note that these variables are submitted attached to the mempool
    // object, so we can hot-swap using pass-by-reference. these
    // modifications change the mempool in real-time.
    //
    console.log("-----------------------------------");
    console.log("how many gts to check? " + this.app.mempool.mempool.golden_tickets.length);
    for (let i = 0; i < this.app.mempool.mempool.golden_tickets.length; i++) {
      console.log("checking GT: " + i);
      const gt = this.app.goldenticket.deserializeFromTransaction(
        this.app.mempool.mempool.golden_tickets[i]
      );
      console.log("comparing " + gt.target_hash + " -- " + previous_block_hash);
      if (gt.target_hash === previous_block_hash) {
        console.log("ADDING GT TX TO BLOCK");
        this.transactions.unshift(this.app.mempool.mempool.golden_tickets[i]);
        this.has_golden_ticket = true;
        this.app.mempool.mempool.golden_tickets.splice(i, 1);
        i = this.app.mempool.mempool.golden_tickets.length + 2;
      }
    }
    console.log("-----------------------------------");

    //
    // contextual values
    //
    const cv = await this.generateConsensusValues();

    //
    // average income and income variance
    //
    this.block.avg_income = cv.avg_income;
    this.block.avg_variance = cv.avg_variance;
    this.block.avg_atr_income = cv.avg_atr_income;
    this.block.avg_atr_variance = cv.avg_atr_variance;

    //
    // ATR transactions - TODO, make more efficient?
    //
    const rlen = cv.rebroadcasts.length;
    for (let i = 0; i < rlen; i++) {
      // cv.rebroadcasts[i].generateMetadata(
      //   this.app,
      //   this.block.id,
      //   BigInt(this.transactions.length)
      // );
      this.transactions.push(cv.rebroadcasts[i]);
    }

    //
    // fee transactions
    //
    if (cv.fee_transaction != null) {
      // cv.fee_transaction.generateMetadata(
      //   this.app,
      //   this.block.id,
      //   BigInt(this.transactions.length)
      // );
      // creator signs fee transaction
      cv.fee_transaction.sign(this.app);
      this.transactions.push(cv.fee_transaction);
    }

    //
    // update slips_spent_this_block so that we have a record of
    // how many times input slips are spent in this block. we will
    // use this later to ensure there are no duplicates. this include
    // during the fee transaction, so that we cannot pay a staker
    // that is also paid this block otherwise.
    //
    for (let i = 0; i < this.transactions.length; i++) {
      // this.transactions[i].generateMetadata(this.app, this.block.id, BigInt(i));
      if (!this.transactions[i].isFeeTransaction()) {
        for (let k = 0; k < this.transactions[i].transaction.from.length; k++) {
          this.transactions[i].generateMetadata(this.app, this.block.id, BigInt(i), "");
          // this.transactions[i].transaction.from[k].generateKey(this.app);
          // TODO : add this check
          this.slips_spent_this_block.set(this.transactions[i].transaction.from[k].returnKey(), 1);
        }
      }
      // for (let k = 0; k < this.transactions[i].transaction.to.length; k++) {
      //   this.transactions[i].transaction.to[k].generateKey(this.app);
      // }
    }
    this.created_hashmap_of_slips_spent_this_block = true;

    //
    // set difficulty
    //
    this.block.difficulty = cv.expected_difficulty;

    //
    // set treasury
    //
    if (cv.nolan_falling_off_chain !== BigInt(0)) {
      this.block.treasury = previous_block_treasury + cv.nolan_falling_off_chain;
    }

    //
    // set staking treasury
    //
    if (cv.staking_treasury !== BigInt(0)) {
      let adjusted_staking_treasury = previous_block_staking_treasury;
      if (cv.staking_treasury < 0) {
        const x: bigint = cv.staking_treasury * BigInt(-1);
        if (adjusted_staking_treasury > x) {
          adjusted_staking_treasury -= x;
        } else {
          adjusted_staking_treasury = BigInt(0);
        }
      } else {
        adjusted_staking_treasury += cv.staking_treasury;
      }
    }

    //
    // generate merkle root
    //
    this.block.merkle = this.generateMerkleRoot();

    //
    // sign the block
    //
    this.sign(this.app.wallet.returnPublicKey(), this.app.wallet.returnPrivateKey());

    //
    // and return to normal
    //
    this.bundling_active = false;
  }

  generateMetadata() {
    //
    // generate block hashes
    //
    this.generateHashes();

    this.generateTransactionsHashmap();

    //
    // if we are generating the metadata for a block, we use the
    // publickey of the block creator when we calculate the fees
    // and the routing work.
    //
    const creator_publickey = this.returnCreator();
    this.transactions.map((tx, index) =>
      tx.generateMetadata(this.app, this.block.id, BigInt(index), this.returnHash())
    );

    //
    // we need to calculate the cumulative figures AFTER the
    // original figures.
    //
    let cumulative_fees = BigInt(0);
    let cumulative_work = BigInt(0);

    let has_golden_ticket = false;
    let has_fee_transaction = false;
    let has_issuance_transaction = false;
    let issuance_transaction_idx = 0;
    let golden_ticket_idx = 0;
    let fee_transaction_idx = 0;

    //
    // we have to do a single sweep through all of the transactions in
    // non-parallel to do things like generate the cumulative order of the
    // transactions in the block for things like work and fee calculations
    // for the lottery.
    //
    // we take advantage of the sweep to perform other pre-validation work
    // like counting up our ATR transactions and generating the hash
    // commitment for all of our rebroadcasts.
    //
    for (let i = 0; i < this.transactions.length; i++) {
      const transaction = this.transactions[i];

      cumulative_fees += transaction.generateMetadataCumulativeFees();
      cumulative_work += transaction.generateMetadataCumulativeWork();

      //
      // update slips_spent_this_block so that we have a record of
      // how many times input slips are spent in this block. we will
      // use this later to ensure there are no duplicates. this include
      // during the fee transaction, so that we cannot pay a staker
      // that is also paid this block otherwise.
      //
      // we skip the fee transaction as otherwise we have trouble
      // validating the staker slips if we have received a block from
      // someone else -- i.e. we will think the slip is spent in the
      // block when generating the FEE TX to check against the in-block
      // fee tx.
      //
      if (!this.has_hashmap_of_slips_spent_this_block) {
        if (transaction.transaction.type !== TransactionType.Fee) {
          for (let i = 0; i < transaction.transaction.from.length; i++) {
            const key = transaction.transaction.from[i].returnKey();
            this.slips_spent_this_block.set(key, 1);
          }
          this.has_hashmap_of_slips_spent_this_block = true;
        }
      }

      // also check the transactions for golden ticket and fees
      if (transaction.transaction.type === TransactionType.Issuance) {
        has_issuance_transaction = true;
        issuance_transaction_idx = i;
      } else if (transaction.transaction.type === TransactionType.Fee) {
        has_fee_transaction = true;
        fee_transaction_idx = i;
      } else if (transaction.transaction.type === TransactionType.GoldenTicket) {
        has_golden_ticket = true;
        golden_ticket_idx = i;
      } else if (transaction.transaction.type === TransactionType.ATR) {
        const bytes = Buffer.concat([
          Buffer.from(this.rebroadcast_hash, "hex"),
          transaction.serializeForSignature(this.app),
        ]);
        this.rebroadcast_hash = this.app.crypto.hash(bytes.toString("hex"));

        for (let i = 0; i < transaction.transaction.from.length; i++) {
          const input = transaction.transaction.from[i];
          this.total_rebroadcast_slips += 1;
          this.total_rebroadcast_nolan += input.returnAmount();
        }
      }
    }

    this.has_fee_transaction = has_fee_transaction;
    this.has_golden_ticket = has_golden_ticket;
    this.has_issuance_transaction = has_issuance_transaction;
    this.fee_transaction_idx = fee_transaction_idx;
    this.golden_ticket_idx = golden_ticket_idx;
    this.issuance_transaction_idx = issuance_transaction_idx;

    //
    // update block with total fees
    //
    this.total_fees = cumulative_fees;
    this.routing_work_for_creator = cumulative_work;

    //
    // note that we have examined the block
    //
    this.has_examined_block = true;

    return true;
  }

  generateHashes() {
    this.hash = this.returnHash();
  }

  generateTransactionsHashmap() {
    if (!this.txs_hmap_generated) {
      for (let i = 0; i < this.transactions.length; i++) {
        for (let ii = 0; ii < this.transactions[i].transaction.from.length; ii++) {
          this.txs_hmap.set(this.transactions[i].transaction.from[ii].add, 1);
        }
        for (let ii = 0; ii < this.transactions[i].transaction.to.length; ii++) {
          // console.log("setting txhmap for " + this.transactions[i].transaction.to[ii].add);
          this.txs_hmap.set(this.transactions[i].transaction.to[ii].add, 1);
        }
      }
      this.txs_hmap_generated = true;
    }
  }

  hasFeeTransaction() {
    return this.has_fee_transaction;
  }

  hasGoldenTicket() {
    if (this.has_examined_block) {
      return this.has_golden_ticket;
    }
    this.generateMetadata();
    return this.has_golden_ticket;
  }

  hasIssuanceTransaction() {
    return this.has_issuance_transaction;
  }

  hasKeylistTransactions(keylist: string[]): boolean {
    if (!this.txs_hmap_generated) {
      console.log("generating tx hashmap for " + JSON.stringify(keylist));
      this.generateTransactionsHashmap();
    }
    for (let i = 0; i < keylist.length; i++) {
      if (this.txs_hmap.get(keylist[i]) == 1) {
        return true;
      }
    }
    return false;
  }

  onChainReorganization(lc: boolean) {
    const block_id = this.returnId();
    for (let i = 0; i < this.transactions.length; i++) {
      // console.log("tx ocr " + i);
      this.transactions[i].onChainReorganization(this.app, lc, block_id);
    }
    // console.log("done tx ocr 1");
    this.lc = lc;
    // console.log("done tx ocr 2");
  }

  asReadableString() {
    let html = "";
    html += `
 Block ${this.block.id} - ${this.returnHash()}
   timestamp:   ${this.block.timestamp}
   prevblock:   ${this.block.previous_block_hash}
   merkle:      ${this.block.merkle}
   burnfee:     ${this.block.burnfee.toString()}
   difficulty:  ${this.block.difficulty}
   streasury:   ${this.block.staking_treasury.toString()}
   *** transactions ***
`;
    for (let i = 0; i < this.transactions.length; i++) {
      html += this.transactions[i].asReadableString();
      html += "\n";
    }
    return html;
  }

  returnBurnFee(): bigint {
    return this.block.burnfee;
  }

  returnCreator(): string {
    return this.block.creator;
  }

  returnFeeTransaction() {
    if (!this.has_fee_transaction) {
      return null;
    }
    if (this.transactions.length === 0) {
      return null;
    }
    return this.transactions[this.ft_idx];
  }

  returnFeesTotal() {
    return this.total_fees;
  }

  returnGoldenTicketTransaction() {
    if (!this.has_golden_ticket) {
      return null;
    }
    if (this.transactions.length === 0) {
      return null;
    }
    return this.transactions[this.gt_idx];
  }

  returnDifficulty() {
    return this.block.difficulty;
  }

  returnFilename(): string {
    if (this.filename === "") {
      this.filename = this.app.storage.generateBlockFilename(this);
    }
    return this.filename;
  }

  returnHash() {
    if (this.hash) {
      return this.hash;
    }
    this.prehash = this.app.crypto.hash(this.serializeForSignature());
    let previous = this.app.binary.hexToSizedArray(this.block.previous_block_hash, 32);
    let prehash = this.app.binary.hexToSizedArray(this.prehash, 32);
    let hashed_buffer = Buffer.concat([previous, prehash]);
    this.hash = this.app.crypto.hash(hashed_buffer);
    return this.hash;
  }

  returnId(): bigint {
    return this.block.id;
  }

  returnPreHash() {
    return this.prehash;
  }

  async runCallbacks(conf, run_callbacks = 1) {
    if (Number(this.confirmations) && this.callbacks) {
      for (let i = Number(this.confirmations) + 1; i <= conf; i++) {
        for (let ii = 0; ii < this.callbacks.length; ii++) {
          try {
            if (run_callbacks === 1) {
              await this.callbacks[ii](this, this.transactions[this.callbackTxs[ii]], i, this.app);
            }
          } catch (err) {
            console.error("ERROR 567567: ", err);
          }
        }
      }
    }
    this.confirmations = conf;
  }

  generateMerkleRoot(): string {
    // console.log("generating merkle root of block : " + this.hash);
    //
    // if we are lite-client and have been given a block without transactions
    // we accept the merkle root since it is what has been provided. users who
    // do not wish to run this risk need necessarily to fully-validate, since
    // they are trusting the server to notify them when there *are* transactions
    // as in any other blockchains/SPV/MR implementation.
    //
    if (this.transactions.length === 0 && (this.app.BROWSER === 1 || this.app.SPVMODE === 1)) {
      console.log("returning block's merkle without calculating");
      return this.block.merkle;
    }

    let mr = "";
    let txs: string[] = [];

    for (let i = 0; i < this.transactions.length; i++) {
      if (this.transactions[i].transaction.type === TransactionType.SPV) {
        txs.push(this.transactions[i].transaction.sig);
      } else {
        txs.push(this.app.crypto.hash(this.transactions[i].serializeForSignature(this.app)));
      }
    }

    while (!mr) {
      const tx2: string[] = [];

      if (txs.length <= 2) {
        if (txs.length === 1) {
          mr = txs[0];
        } else {
          mr = this.app.crypto.hash(Buffer.from("" + txs[0] + txs[1], "hex"));
        }
      } else {
        for (let i = 0; i < txs.length; i++) {
          if (i <= txs.length - 2) {
            tx2.push(this.app.crypto.hash(Buffer.from("" + txs[i] + txs[i + 1], "hex")));
            i++;
          } else {
            tx2.push(txs[i]);
          }
        }

        txs = tx2;
      }
    }
    return mr;
  }

  //
  // returns a lite-version of the block
  //
  returnLiteBlock(keylist = []): Block {
    let pruned_transactions = [];

    //
    // generate lite-txs
    //
    for (let i = 0; i < this.transactions.length; i++) {
      let add_this_tx = 0;
      for (let k = 0; k < keylist.length; k++) {
        if (this.transactions[i].hasPublicKey(keylist[k])) {
          add_this_tx = 1;
          k = keylist.length;
        }
        if (this.transactions[i].isGoldenTicket()) {
          add_this_tx = 1;
          k = keylist.length;
        }
      }

      if (add_this_tx == 1) {
        pruned_transactions.push(this.transactions[i]);
      } else {
        let spv = new Transaction();
        spv.transaction.type = 9;
        spv.transaction.r = 1;
        // the sig contains the hash of this TX
        spv.transaction.sig = this.app.crypto.hash(
          this.transactions[i].serializeForSignature(this.app)
        );

        //delete spv.transaction.to;
        //delete spv.transaction.from;
        //delete spv.transaction.m;
        //delete spv.transaction.ts;
        //delete spv.transaction.path;

        delete spv.fees_total;
        delete spv.work_available_to_me;
        delete spv.work_available_to_creator;
        delete spv.work_cumulative;
        delete spv.msg;
        delete spv.dmsg;
        delete spv.size;
        delete spv.is_valid;
        delete spv.path;
        pruned_transactions.push(spv);
      }
    }

    //
    // prune unnecessary txs into merkle-tree
    //
    let no_simplification_needed = 0;
    /*****
    while (no_simplification_needed == 0) {
      let action_taken = 0;
      for (let i = 1; i < pruned_transactions.length; i++) {
        if (pruned_transactions[i].transaction.type == 9 && pruned_transactions[i-1].transaction.type == 9) {
          if (pruned_transactions[i].transaction.r == pruned_transactions[i-1].transaction.r) {
            pruned_transactions[i].transaction.r *= 2;
            pruned_transactions[i].transaction.sig = this.app.crypto.hash(pruned_transactions[i-1].transaction.sig + pruned_transactions[i].transaction.sig);
            pruned_transactions.splice(i-1, 0);
            action_taken = 1;
          }
        }
      }
      if (action_taken == 0) {
        no_simplification_needed = 1;
      }
    }
****/

    let newblk = new Block(this.app);
    newblk.block = Object.assign({}, this.block);
    newblk.transactions = pruned_transactions;

    return newblk;
  }

  returnPreviousBlockHash() {
    return this.block.previous_block_hash;
  }

  returnStakingTreasury() {
    return this.block.staking_treasury;
  }

  returnTreasury() {
    return this.block.treasury;
  }

  returnTimestamp() {
    return this.block.timestamp;
  }

  /**
   * Serialize Block
   * @returns {array} - raw bytes
   * @param block_type
   */
  serialize(block_type = BlockType.Full) {
    //
    // ensure strings have appropriate number of bytes if empty
    //
    const block_previous_block_hash = this.block.previous_block_hash;
    // if (block_previous_block_hash === "") { block_previous_block_hash = "0000000000000000000000000000000000000000000000000000000000000000"; }

    //
    // TODO - there is a cleaner way to do this
    //
    const block_merkle = this.block.merkle;
    const block_creator = this.block.creator;
    const block_signature = this.block.signature;

    console.log(`block.serialize : tx count = ${this.transactions.length} for ${this.hash}`);
    let transactions_length = this.app.binary.u32AsBytes(this.transactions.length);

    const id = this.app.binary.u64AsBytes(this.block.id);
    const timestamp = this.app.binary.u64AsBytes(this.block.timestamp);

    const previous_block_hash = this.app.binary.hexToSizedArray(block_previous_block_hash, 32);
    const creator = this.app.binary.hexToSizedArray(this.app.crypto.fromBase58(block_creator), 33);
    const merkle_root = this.app.binary.hexToSizedArray(block_merkle, 32);
    const signature = this.app.binary.hexToSizedArray(block_signature, 64);

    const treasury = this.app.binary.u128AsBytes(this.block.treasury.toString());
    const staking_treasury = this.app.binary.u128AsBytes(this.block.staking_treasury.toString());
    const burnfee = this.app.binary.u128AsBytes(this.block.burnfee.toString());
    const difficulty = this.app.binary.u64AsBytes(this.block.difficulty);

    const avg_income = this.app.binary.u128AsBytes(this.block.avg_income.toString());
    const avg_variance = this.app.binary.u128AsBytes(this.block.avg_variance.toString());
    const avg_atr_income = this.app.binary.u128AsBytes(this.block.avg_atr_income.toString());
    const avg_atr_variance = this.app.binary.u128AsBytes(this.block.avg_atr_variance.toString());

    const block_header_data = new Uint8Array([
      ...transactions_length,
      ...id,
      ...timestamp,
      ...previous_block_hash,
      ...creator,
      ...merkle_root,
      ...signature,
      ...treasury,
      ...staking_treasury,
      ...burnfee,
      ...difficulty,
      ...avg_income,
      ...avg_variance,
      ...avg_atr_income,
      ...avg_atr_variance,
    ]);

    if (block_type === BlockType.Header) {
      const ret = new Uint8Array(BLOCK_HEADER_SIZE);
      ret.set(block_header_data, 0);
      return ret;
    }

    //
    // add transactions for FULL blocks
    //
    let total_tx_length = 0;
    const transactions = [];
    for (let i = 0; i < this.transactions.length; i++) {
      const next_tx_data = this.transactions[i].serialize(this.app);
      total_tx_length += next_tx_data.length;
      transactions.push(next_tx_data);
    }

    const ret = new Uint8Array(BLOCK_HEADER_SIZE + total_tx_length);
    ret.set(block_header_data, 0);
    let next_tx_location = BLOCK_HEADER_SIZE;
    for (let i = 0; i < transactions.length; i++) {
      // console.debug(
      //   `block.serialize : tx ${i} starting = ${next_tx_location}, length = ${
      //     transactions[i].length
      //   }, sig = ${this.transactions[i].returnSignature(this.app)}`
      // );
      ret.set(transactions[i], next_tx_location);
      next_tx_location += transactions[i].length;
    }

    return ret;
  }

  serializeForSignature(): Buffer {
    return Buffer.concat([
      this.app.binary.u64AsBytes(this.block.id),
      this.app.binary.u64AsBytes(this.block.timestamp),
      this.app.binary.hexToSizedArray(this.block.previous_block_hash, 32),
      this.app.binary.hexToSizedArray(this.app.crypto.fromBase58(this.block.creator), 33),
      this.app.binary.hexToSizedArray(this.block.merkle, 32),
      this.app.binary.u128AsBytes(this.block.treasury.toString()),
      this.app.binary.u128AsBytes(this.block.staking_treasury.toString()),
      this.app.binary.u128AsBytes(this.block.burnfee.toString()),
      this.app.binary.u64AsBytes(this.block.difficulty),
      this.app.binary.u128AsBytes(this.block.avg_income),
      this.app.binary.u128AsBytes(this.block.avg_variance),
      this.app.binary.u128AsBytes(this.block.avg_atr_income),
      this.app.binary.u128AsBytes(this.block.avg_atr_variance),
    ]);
  }

  sign(publickey: string, privatekey: string) {
    this.block.creator = publickey;
    this.block.signature = this.app.crypto.signBuffer(this.serializeForSignature(), privatekey);
  }

  async validate() {
    this.generateMetadata();

    // TODO - lite-client validation
    if (this.app.BROWSER == 1) {
      const cv = await this.generateConsensusValues();
      return true;
    }

    if (this.block_type === BlockType.Ghost) {
      console.log("block validates as true since it is a ghost block");
      return true;
    }

    // invalid if no transactions
    if (this.transactions.length === 0) {
      console.error("ERROR 582034: no transactions in blocks, thus invalid");
      return false;
    }

    // verify creator signed
    if (
      !this.app.crypto.verifyHash(
        this.serializeForSignature(),
        this.block.signature,
        this.block.creator
      )
    ) {
      console.error("ERROR 582039: block is not signed by creator or signature does not validate");
      return false;
    }

    // if this is our first / genesis block, it is valid
    if (
      this.returnHash() === this.app.blockchain.blockchain.genesis_block_hash ||
      this.app.blockchain.blockchain.genesis_block_hash === ""
    ) {
      console.log(
        "DEBUG SERVER CRASH: saved genesis_block_hash is: " +
          this.app.blockchain.blockchain.genesis_block_hash
      );
      console.log(`approving ${this.returnHash()} as genesis block`);
      return true;
    }

    // generate consensus values
    const cv = await this.generateConsensusValues();

    // average income and average income variance
    if (cv.avg_income !== this.block.avg_income) {
      console.error("ERROR 712923: block is mis-reporting its average income");
      return false;
    }
    if (cv.avg_variance !== this.block.avg_variance) {
      console.error("ERROR 712923: block is mis-reporting its average variance");
      return false;
    }

    // average atr income and average atr income variance
    if (cv.avg_atr_income !== this.block.avg_atr_income) {
      console.error("ERROR 712923: block is mis-reporting its average atr income");
      return false;
    }
    if (cv.avg_atr_variance !== this.block.avg_atr_variance) {
      console.error("ERROR 712923: block is mis-reporting its average atr variance");
      return false;
    }

    // only block #1 can have an issuance transaction
    if (cv.it_num > 0 && this.block.id > BigInt(1)) {
      console.error("ERROR 712923: blockchain contains issuance after block 1 in chain");
      return false;
    }

    // checks against previous block
    const previous_block = await this.app.blockchain.loadBlockAsync(this.block.previous_block_hash);

    if (previous_block) {
      //
      // nope out for ghost blocks as previous blocks - we only get on catch-up SPV sync
      //
      if (previous_block.isType("Ghost")) {
        return 1;
      }

      //
      // treasury
      //
      if (this.returnTreasury() !== previous_block.returnTreasury() + cv.nolan_falling_off_chain) {
        console.log("ERROR 123243: treasury is not calculated properly");
        return false;
      }

      //
      // staking treasury
      //
      let adjusted_staking_treasury = previous_block.returnStakingTreasury();
      const cv_st = cv.staking_treasury;
      if (cv_st < BigInt(0)) {
        const x: bigint = cv_st * BigInt(-1);
        if (adjusted_staking_treasury > x) {
          adjusted_staking_treasury = adjusted_staking_treasury - x;
        } else {
          adjusted_staking_treasury = BigInt(0);
        }
      } else {
        adjusted_staking_treasury = adjusted_staking_treasury + cv_st;
      }
      if (this.returnStakingTreasury().toString() !== adjusted_staking_treasury.toString()) {
        console.log("ERROR 820391: staking treasury does not validate");
        return false;
      }

      //
      // burn fee
      //
      const new_burnfee = this.app.burnfee.returnBurnFeeForBlockProducedAtCurrentTimestampInNolan(
        previous_block.returnBurnFee(),
        this.returnTimestamp(),
        previous_block.returnTimestamp()
      );
      if (new_burnfee !== this.returnBurnFee()) {
        console.log("ERROR 182085: burn fee not calculated properly thus invalid");
        return false;
      }

      //
      // validate routing work required
      //
      const amount_of_routing_work_needed =
        this.app.burnfee.returnRoutingWorkNeededToProduceBlockInNolan(
          previous_block.returnBurnFee(),
          this.returnTimestamp(),
          previous_block.returnTimestamp()
        );
      if (this.routing_work_for_creator < amount_of_routing_work_needed) {
        console.log("ERROR 510293: block lacking adequate routing work from creator");
        return false;
      }

      //
      // validate golden ticket
      //
      // the golden ticket is a special kind of transaction that stores the
      // solution to the network-payment lottery in the transaction message
      // field. it targets the hash of the previous block, which is why we
      // tackle it's validation logic here.
      //
      // first we reconstruct the ticket, then calculate that the solution
      // meets our consensus difficulty criteria. note that by this point in
      // the validation process we have already examined the fee transaction
      // which was generated using this solution. If the solution is invalid
      // we find that out now, and it invalidates the block.
      //
      if (cv.gt_num > 0) {
        const golden_ticket_transaction = this.transactions[cv.gt_idx];
        const gt = this.app.goldenticket.deserializeFromTransaction(golden_ticket_transaction);

        const solution = new GoldenTicket(this.app);
        if (
          !solution.validate(
            previous_block.returnHash(),
            gt.random_hash,
            gt.creator,
            previous_block.returnDifficulty()
          )
        ) {
          console.error("ERROR 801923: golden ticket included in block is invalid");
          return false;
        }

        // const solution = this.app.goldenticket.generateSolution(
        //   previous_block.returnHash(),
        //   gt.target_hash,
        //   gt.random_bytes,
        //   gt.creator
        // );
        // if (
        //   !this.app.goldenticket.isValidSolution(
        //     solution,
        //     previous_block.returnDifficulty()
        //   )
        // ) {
        //   console.log(
        //     "ERROR 801923: golden ticket included in block is invalid"
        //   );
        //   return false;
        // }
      }
    } else {
      //
      // no previous block?
      //
    }

    //
    // validate atr
    //
    // Automatic Transaction Rebroadcasts are removed programmatically from
    // an earlier block in the blockchain and rebroadcast into the latest
    // block, with a fee being deducted to keep the data on-chain. In order
    // to validate ATR we need to make sure we have the correct number of
    // transactions (and ONLY those transactions!) included in our block.
    //
    // we do this by comparing the total number of ATR slips and nolan
    // which we counted in the generate_metadata() function, with the
    // expected number given the consensus values we calculated earlier.
    //
    if (cv.total_rebroadcast_slips !== this.total_rebroadcast_slips) {
      console.log("ERROR 624442: rebroadcast slips total incorrect");
      return false;
    }
    if (cv.total_rebroadcast_nolan !== this.total_rebroadcast_nolan) {
      console.log(
        `ERROR 294018: rebroadcast nolan amount incorrect: ${cv.total_rebroadcast_nolan} - ${this.total_rebroadcast_nolan}`
      );
      return false;
    }
    if (cv.rebroadcast_hash !== this.rebroadcast_hash) {
      console.log("ERROR 123422: hash of rebroadcast transactions incorrect");
      return false;
    }

    let generated_merkle_root = this.generateMerkleRoot();
    // validate merkle root
    if (this.block.merkle !== generated_merkle_root) {
      console.log(
        `merkle root : ${this.block.merkle} is different from expected : ${generated_merkle_root}`
      );
      return false;
    }

    //
    // validate fee transactions
    //
    // if this block contains a golden ticket, we have to use the random
    // number associated with the golden ticket to create a fee-transaction
    // that stretches back into previous blocks and finds the winning nodes
    // that should collect payment.
    //
    if (cv.ft_num > 0) {
      // no golden ticket? invalid
      if (cv.gt_num === 0) {
        console.log("ERROR 48203: fee transaction exists but no golden ticket, thus invalid");
        return false;
      }

      const fee_transaction = this.transactions[cv.ft_idx];

      //
      // the fee transaction we receive from the CV needs to be updated with
      // block-specific data in the same way that all the transactions in
      // the block have been. we must do this prior to comparing them.
      //
      cv.fee_transaction.generateMetadata(
        this.app,
        this.block.id,
        BigInt(cv.ft_idx),
        this.returnHash()
      );

      const hash1 = this.app.crypto.hash(fee_transaction.serializeForSignature(this.app));
      const hash2 = this.app.crypto.hash(cv.fee_transaction.serializeForSignature(this.app));

      if (hash1 !== hash2) {
        console.error(
          `ERROR 892032: block ${this.hash} fee transaction doesn't match cv fee transaction`
        );
        console.log("expected: ", cv.fee_transaction);
        console.log("actual: ", fee_transaction);
        console.log(
          `gt count = ${cv.gt_num} gt index = ${
            cv.gt_idx
          } has gt = ${this.hasGoldenTicket()} index from block = ${this.golden_ticket_idx}`
        );
        return false;
      }
    }

    //
    // validate difficulty
    //
    // difficulty here refers the difficulty of generating a golden ticket
    // for any particular block. this is the difficulty of the mining
    // puzzle that is used for releasing payments.
    //
    // those more familiar with POW and POS should note that "difficulty" of
    // finding a block is represented in the burn fee variable which we have
    // already examined and validated above. producing a block requires a
    // certain amount of golden ticket solutions over-time, so the
    // distinction is in practice less clean.
    //
    if (cv.expected_difficulty !== this.returnDifficulty()) {
      console.log(
        "ERROR 202392: difficulty is invalid - " +
          cv.expected_difficulty +
          " versus " +
          this.returnDifficulty()
      );
      return false;
    }

    //
    // validate transactions
    //
    // validating transactions requires checking that the signatures are valid,
    // the routing paths are valid, and all of the input slips are pointing
    // to spendable tokens that exist in our UTXOSET. this logic is separate
    // from the validation of block-level variables, so is handled in the
    // transaction objects.
    //
    // this is one of the most computationally intensive parts of processing a
    // block which is why we handle it in parallel. the exact logic needed to
    // examine a transaction may depend on the transaction itself, as we have
    // some specific types (Fee / ATR / etc.) that are generated automatically
    // and may have different requirements.
    //
    // the validation logic for transactions is contained in the transaction
    // class, and the validation logic for slips is contained in the slips
    // class. Note that we are passing in a read-only copy of our UTXOSet so
    // as to determine spendability.
    //
    // TODO - remove when convenient. when transactions fail to validate using
    // parallel processing can make it difficult to find out exactly what the
    // problem is. ergo this code that tries to do them on the main thread so
    // debugging output works.
    //
    for (let i = 0; i < this.transactions.length; i++) {
      const is_valid = this.transactions[i].validate(this.app);
      if (!is_valid) {
        console.log("ERROR 579128: transaction is invalid");
        return false;
      }
    }

    return true;
  }

  //
  // if the block is not at the proper type, try to upgrade it to have the
  // data that is necessary for blocks of that type if possible. if this is
  // not possible, return false. if it is possible, return true once upgraded.
  //
  async upgradeBlockToBlockType(block_type) {
    if (this.isType(block_type)) {
      return true;
    }
    //
    // Ghost blocks nope out
    //
    if (this.isType("Ghost")) {
      return false;
    }

    //
    // load block from disk if full is needed
    //
    if (block_type === "Full") {
      //
      // lite-browsers cannot load from disk
      //
      if (this.app.BROWSER == 0) {
        let block = await this.app.storage.loadBlockByFilename(
          this.app.storage.generateBlockFilename(this)
        );
        block.generateHashes();
        this.transactions = block.transactions;
        this.generateMetadata();
        this.block_type = BlockType.Full;
      } else {
        return false;
      }

      return true;
    }

    return false;
  }
}

export default Block;
