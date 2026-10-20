import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { WrapInfo } from '@api/models/wrap-info';
import { PriceInfo, VerifiedAssetInfoWhitelist } from '@api/models/assets.model';
import { catchError, map } from 'rxjs/operators';

/** Trade USD book — ticker → USD (PDC from book/env, wraps from CoinGecko / peg). */
export interface TradeUsdPricesResponse {
    updatedAt: number;
    prices: Record<string, number>;
}

const TRADE_API_BASE = 'https://api.trade.privacydatacoin.com';

@Injectable({
    providedIn: 'root',
})
export class ApiService {
    private _httpClient = inject(HttpClient);

    getWrapInfo(): Observable<WrapInfo> {
        return this._httpClient.get<WrapInfo>('https://wrapped.privacydatacoin.com/api2/get_wrap_info');
    }

    getVerifiedAssetInfoWhitelist(type: 'mainnet' | 'testnet'): Observable<{
        assets: VerifiedAssetInfoWhitelist;
        signature: string;
    }> {
        let url: string;
        if (type === 'mainnet') {
            url = 'https://api.privacydatacoin.com/assets_whitelist.json';
        } else {
            url = 'https://api.privacydatacoin.com/assets_whitelist_testnet.json';
        }

        return this._httpClient.get<{ assets: VerifiedAssetInfoWhitelist; signature: string }>(url, {
            headers: { 'Cache-Control': 'no-cache' },
        });
    }

    /** Batch USD marks from Trade (preferred source for wallet portfolio value). */
    getTradeUsdPrices(): Observable<TradeUsdPricesResponse> {
        return this._httpClient.get<TradeUsdPricesResponse>(`${TRADE_API_BASE}/api/prices/usd`).pipe(
            catchError(() => of({ updatedAt: 0, prices: {} }))
        );
    }

    getCurrentPriceForAsset(asset_id: string): Observable<PriceInfo & { asset_id: string }> {
        return this._httpClient
            .get<
                PriceInfo & {
                    asset_id: string;
                }
            >(`https://explorer.privacydatacoin.com/api/price?asset_id=${asset_id}`)
            .pipe(
                map((response) => ({ ...response, asset_id })),
                catchError(() =>
                    of({
                        success: false,
                        data: 'Asset not found',
                        asset_id,
                    })
                )
            );
    }
}
