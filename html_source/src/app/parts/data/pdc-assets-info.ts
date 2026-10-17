import { AssetInfo } from '@api/models/assets.model';

export type PdcAssetInfo = AssetInfo & { logo: string; price_url: string };

export const PDC_ASSET_INFO: PdcAssetInfo = {
    asset_id: 'd6329b5b1f7c0805b5c345f4957554002a2f557845f64d7645dae0e051a6498a',
    current_supply: 0,
    decimal_point: 12,
    full_name: 'Pdc',
    logo: 'assets/currency-icons/pdc.png',
    meta_info: '',
    owner: '0000000000000000000000000000000000000000000000000000000000000000',
    price_url: 'https://explorer.privacydatacoin.com/api/price?asset=pdc',
    ticker: 'PDC',
    total_max_supply: 0,
};

/** Wrapped Bitcoin (BTCX) — logo is GUI-only; whitelist JSON has no logo field. */
export const BTCX_ASSET_ID = 'c2bf0410873b49ec7e7dd19d62bca9625d80cd3123670a67b48d997d3127426d';

/** Orange Bitcoin mark (same artwork as wbtc.svg). */
export const BTCX_ASSET_LOGO = 'assets/currency-icons/wbtc.svg';
