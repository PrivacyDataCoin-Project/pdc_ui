# PDC UI audit

Status: **READY FOR REVIEW**

Scope: `PrivacyDataCoin-Project/pdc_ui` as of `master` at the time of this branch. This pass maps the UI, records defects, and changes only defects that are visible in the TypeScript/HTML and whose fix does not depend on an unobserved daemon payload.

The committed `html/` tree is the desktop bundle produced by `npm run "build --html"`. This branch does not regenerate it.

## Architecture

The UI is an Angular 14 application (`html_source/`) hosted in a Qt WebEngine shell. It is not a public website.

- `html_source/src/index.html` loads `qrc:///qtwebchannel/qwebchannel.js`.
- `BackendService.initService()` binds `window.QWebChannel` to `channel.objects.mediator_object`.
- Wallet and daemon operations go through named commands (`BackendService.runCommand`), not through browser `fetch` to the node. `call_rpc` / `call_wallet_rpc` proxy JSON-RPC into the native process.
- `AppComponent` starts the backend with `start_backend` aimed at `127.0.0.1:11512` and subscribes to daemon/wallet signals before that call.
- `ApiService` is the HTTP edge: USD prices, asset whitelist, wrap info (explorer, trade, `api.privacydatacoin.com`).
- Routing is hash-based. Onboarding lives in `PagesRoutingModule`. The open wallet lives under `wallet` (`WalletAccessGuard`) with tabs: assets, history, send, receive, swap, staking, custom assets.
- Session state is in memory on `VariablesService` (wallets, settings, prices, deeplink stream). Durable settings go through `get_app_data` / `store_app_data`. Wallet passwords and contacts go through `store_secure_app_data` when a master password is set.
- Amounts cross the UI as decimal strings. Atomic integers use `moneyToInt` / `intToMoney` (PDC display scale defaults to 12). Alias fees and the send fee are converted to atomic units before the native command. Send destination amounts stay decimal strings.

`ng serve` can render the shell in a browser. Without the Qt mediator, wallet commands do not run.

## Trust boundaries

| Boundary | What crosses it |
| --- | --- |
| User input | Addresses, amounts, comments, seed, passwords, CSV contacts, deeplink strings |
| Qt mediator | Full control of wallet RPC, files, clipboard, open-URL. The page trusts the desktop binary |
| Local daemon | Default `127.0.0.1:11512`, plus whatever remote node the native settings use |
| Remote HTTP | Prices and whitelist JSON. The whitelist loader reads `assets`; this UI does not verify the signature field |
| Deeplink | Native `handle_deeplink_click` → `parseDeeplinkString`, gated on login, `daemon_state === 2`, and `sync_started` |
| Logs | `BackendService.Debug` writes command params and results to the console |

## What was fixed

### 1. `moneyToInt` dropped the wrong fractional digits

`String.prototype.slice` takes an end index. The overflow branch used `slice(point_index + 1, decimal_point)`, so a value such as `1.23456` at 3 decimal places became `1` instead of `1.234` (`1234` atomic).

Typed fields that use `appInputValidate` already cap the fraction length, so normal typing often never hit this. Deeplink prefill and any other caller that passes extra digits did. Existing unit cases still pass; new cases cover the overflow path.

### 2. Master-password login never restored contacts

Secure data is stored as `{ wallets, contacts }`. Login checked the key `contracts` and then read `contacts`, so the restore block never ran. Both checks now use `contacts`, and the value must be an array before `.map`.

### 3. Login no longer throws when secure data is missing

`getData` read `data.error_code` even when `data` was missing, which left the submit button spinning. A missing payload is treated as a failed password. Any other `error_code` clears the spinner. A payload without `error_code` is still accepted: `backendCallback` only sets `status === true` when the JSON itself contains `error_code` `OK` or `TRUE`, and a normal vault document is `{ wallets, contacts }` with neither field. Requiring `status === true` would lock out that shape.

Opening saved wallets no longer clears `submitLoading` before the `openWallet` callbacks return. The flag drops after every wallet in the batch has settled, which blocks a second submit during the batch.

### 4. Startup "open wallets" modal read the wrong wallet-info field

Every other open/create/restore path copies `wi.tracking_hey` (the name the wallet info object actually uses). The modal copied `wi.tracking_key`, so those wallets stored an empty tracking field.

### 5. History pagination guard never stayed set

`runCommand` set `get_recent_transfers` and then cleared it before the Qt callback. `HistoryComponent.setPage` uses the flag to ignore overlapping page requests. The flag is now cleared when the command is missing, or inside `backendCallback` once the call is not `CORE_BUSY` (retries keep it set).

### 6. Closing the last wallet left it in `settings.wallets`

`storeAppData` rewrites `settings.wallets` only when `wallets.length > 0`, so a settings save before any wallet is open does not wipe the saved list. `WalletsService.closeWallet` never updated that list. It now writes the still-open wallets (including an empty list) and then calls `storeAppData`. Quit still calls `storeAppData` before it closes wallets, so a normal exit keeps the list. Closing the last wallet also clears `current_wallet`.

### 7. Contact import was not written to the secure store

After a CSV import with a master password set, contacts lived only in memory. Import now calls `storeSecureAppData` in that case. Export no longer `delete`s `alias` on the in-memory contact; it strips the field on a copy.

Import still navigates to `/contacts`. There is no such route in this tree. This change does not invent a contacts screen.

### 8. Seed phrase was revealed before the RPC returned

`SeedPhraseComponent` set `showSeed` before `getSmartWalletInfo` answered, so a failed or empty response showed the seed panel with no words. The panel opens only when a non-empty `seed_phrase` is present. Wallet details does the same for an empty phrase.

### 9. Create-swap form

- Receiving amount `"0"` passed validation because `!control.value` is true for `"0"` and the later `=== 0` check never saw the string. It now uses `BigNumber`, same idea as the sending side. Empty stays valid here so `Validators.required` still owns that case.
- When the two assets differed, `setErrors(null)` wiped `required` on the receiving asset. Only `sameAssetsId` is added or removed.
- `submit()` set `loading$` and returned when an asset id was missing, which left the submit button disabled. Those returns now clear `loading$`.

### 10. Swap confirm dialog used the 12-decimal default for one side

`confirm-swap` passes each asset's `decimal_point` into `intToMoney`. The master-password confirm did that for `to_initiator` only. `to_finalizer` now does the same. The value sent on chain is still the proposal from RPC; this is the number the user reads before accepting.

### 11. Console traces redacted secret fields

`commandDebug` logged command params and parsed results, including `pass`, seed fields, and companion `secret`. `dispatch_async_call_result` logged the raw JSON. The objects handed to callbacks are unchanged. The console copies replace those keys with `[redacted]`.

## Reviewed and not changed

| Item | Why it stayed |
| --- | --- |
| Send confirm fee looks "double converted" | `getTransferParams` stores an atomic fee and the dialog pipes it through `intToMoney`. That is the inverse, not a second lossy conversion. `0.01` at 12 decimals is atomic `10000000000`, which displays as `0.01`. |
| Send destination amounts stay decimal strings while the fee is atomic | Alias registration converts fees with `moneyToInt`. Destination amounts are not converted in this UI. Changing that without the native `transfer` handler would rescale real transfers. |
| `intToMoney` uses `Math.pow(10, decimals)` | Powers of ten through `10^22` are exact IEEE-754 doubles (`5^n` still fits in 53 bits). The UI's tested range stops at 20. |
| Fiat mode uses `currency_price \|\| 1` | A missing price would treat the fiat number as an asset amount. The amount field disables the fiat toggle when the price request failed. A hard block needs a translated error and a check that price `0` cannot occur for a listed asset. |
| Login does not require `status === true` | See fix 3. A wrong-password body of `{ error_code: 'WRONG_PASSWORD' }` is already handled. A body that puts the error only on `status` and returns a payload without `error_code` would still be treated as success. That shape was not captured here. |
| `setupJwtWalletRpc` saves settings even when the command fails | Same `status` ambiguity. Failing closed could stop a successful enable from being stored if the native method returns an empty string (`backendCallback` then yields `status === false`). |
| Tor forced off on startup | `app.component.ts` sets `appUseTor: false` with an explicit TODO, and the settings template disables the control. Turning it back on is a product change. |
| Swap address check is a sync validator that calls RPC later | Send uses `debouncedAsyncValidator`. Replacing the swap validator is a behavior change around in-flight requests, not a local correction. |
| `runWallet` failure after `addWallet` | The wallet stays in the sidebar. Removing it from the failure callback also has to avoid fighting `closeWallet`'s navigation and secure-store write. |
| `sync_started` is one global flag | Any wallet reaching progress 100 clears it, so a deeplink can proceed while another wallet is still syncing. The safe replacement is "any wallet still in `sync_wallets`", which changes the deeplink gate. |
| Deeplink wallet filter | `!is_watch_only \|\| !is_auditable \|\| loaded` excludes only a watch-only auditable wallet that is not loaded. The intended predicate is not stated in code. |
| `html/` bundle | Rebuild belongs to the existing `main` workflow that commits the bundle, not to this source fix. |

## How to verify

Unit tests (no Qt), run on this branch:

```bash
cd html_source
npm install
npx ng test --watch=false --browsers=ChromeHeadless
```

Result: **122 of 122 SUCCESS** (Chrome Headless). That includes the new `moneyToInt` cases in `src/app/parts/functions/money-to-int.spec.ts` and the existing login specs.

`npx ng lint` still reports 5 Prettier errors in `wallet.model.ts`, `api.service.ts`, and `app.component.ts`. Those files are unchanged on this branch.

Targeted run:

```bash
cd html_source
npx ng test --watch=false --browsers=ChromeHeadless --include='**/money-to-int.spec.ts'
```

Lint of the touched project:

```bash
cd html_source
npx ng lint
```

Desktop checks (need the Qt shell; not executed in this pass):

1. Master password login with a secure blob that contains contacts. After login, `VariablesService.contacts` matches the blob. Restart and log in again.
2. Wrong master password still shows the wrong-password error and the button is usable again.
3. Open several saved wallets from that login. The button stays disabled until each `openWallet` callback has returned.
4. Close the last wallet, quit, start again. The open-wallet list is empty (no master password) or the secure blob no longer lists that wallet (master password).
5. Open a wallet from the startup modal and confirm `tracking_hey` matches a wallet opened from the Open screen.
6. History: change page quickly. Only one `get_recent_transfers` is in flight; the next page starts after the callback.
7. Create swap: receiving amount `0` is rejected. Two different assets do not clear the required error on an empty receiving asset. A missing asset id does not leave the spinner up.
8. Accept a swap whose `to_finalizer` asset is not 12 decimals. The master-password dialog matches the confirm-swap page.
9. Reveal a seed with a bad passphrase. The seed panel stays hidden.
10. Import a CSV while a master password is set, restart, log in. Contacts are still there.
11. DevTools during open/restore/seed: console lines show `[redacted]` for `pass` and `seed_phrase`.

## Residual risk

- Remote price and whitelist responses are trusted for display. A bad price can still move a fiat-mode send if the toggle is on and the price is `0`.
- Deeplink amounts now truncate with the corrected `moneyToInt`. The user still confirms the truncated amount; the UI does not warn that extra digits were cut.
- Secret redaction covers the known key names only. A seed placed in an unexpected field would still be logged.
- This UI cannot prove the native `transfer` amount encoding. Do not "normalize" destination amounts to atomic units until that handler is read.
