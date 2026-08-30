# TripBoard financial model

## The invariant

Money movement and consumption are different facts.

An Octopus top-up says value moved from an external funding source into a local wallet. An MTR fare says local value was consumed. Adding those figures together would count the same money twice, so TripBoard never presents “own-money outflow + local consumption = total”.

## Accounts

`EXTERNAL_SOURCE` accounts describe where trip money comes from: credit cards, debit cards, bank accounts, and INR cash. Their ordinary bank balances are deliberately not tracked.

`STORED_VALUE` accounts are balances the travellers need operationally: each physical Octopus card, HKD cash, and MOP cash. Separate Octopus accounts represent separate physical balances, not personal spending ownership.

Card records may contain a nickname, issuer, network, billing currency, and last four digits. Full card numbers, CVV, PINs, and banking credentials are forbidden.

## Events

- `PURCHASE` increases local consumption. A stored-value purchase also decreases that wallet. A direct external-card purchase records INR outflow on the same transaction.
- `FUND_WALLET` increases a local wallet and records external INR funding. It creates no consumption.
- `INTERNAL_TRANSFER` debits one stored-value account and credits another. It changes neither outflow nor consumption.
- `CASH_EXCHANGE` records actual source and destination currency amounts, credits the destination cash wallet, and records INR outflow. It creates no consumption.
- `PURCHASE_REFUND` reduces the original category consumption. It may credit stored value; if it returns to an external card, its actual INR refund reduces outflow.
- `FUNDING_REFUND` returns unused stored value to an external source. It does not create negative food or transport spending.
- `BALANCE_ADJUSTMENT` reconciles the recorded and observed wallet balance. It changes neither budget consumption nor own-money outflow and remains visibly uncategorised until reconciled.

Future purchases are not allocated to historical top-ups. The account ledger supplies the correct aggregate balance without inventing provenance.

## Authoritative calculations

The database views/functions are authoritative:

**Own-money outflow** is net INR external cash flow. Settled INR is used when present; otherwise estimated INR is included and the aggregate is labelled as estimated.

**Local consumption** is purchase consumption minus purchase refunds, grouped by original currency and category. Funding, transfers, exchanges, balance corrections, and unused-wallet refunds are excluded.

**Stored-value balance** is opening balance plus incoming funding/transfers/refunds, minus purchases/outgoing transfers/funding refunds, plus or minus visible balance adjustments.

All financial database amounts use `numeric(18,4)`. Frontend previews use `decimal.js`; authoritative calculations never rely on JavaScript binary floating point.

## Transaction safety

The browser cannot construct arbitrary ledger rows. RPC functions:

1. confirm active trip membership;
2. confirm that every account belongs to the same trip;
3. validate account classes and currencies;
4. lock affected stored-value account rows;
5. recompute the wallet balance inside the same transaction;
6. reject insufficient funds;
7. insert the complete event atomically;
8. return the existing event when `(trip_id, idempotency_key)` already exists.

Postgres functions execute atomically by default. The row lock serializes concurrent wallet writes. With HK$100 available, simultaneous HK$80 and HK$50 purchases cannot both commit.

Financial edits carry a `version`. `settle_card_transaction` requires the caller’s expected version and rejects stale edits, preventing blind last-write-wins. Normal UI does not hard-delete settled records; refunds, reversals, or auditable edits preserve history.

## Offline behavior

Every queued financial command retains its original UUID. Replay calls the same idempotent RPC, so a timeout followed by a retry cannot duplicate a charge. If another device used the wallet while both were offline, the server rejects the command that would make the balance impossible. The UI marks it as a conflict instead of silently allowing a negative balance.

## Acceptance scenarios

The unit suite covers all ten required scenarios: wallet funding, wallet purchase, direct card purchase, cash exchange, cash purchase, internal transfer, purchase refund, duplicate replay, competing wallet spends, and balance correction. Database-level tests exercise the RPC and RLS boundary separately.
