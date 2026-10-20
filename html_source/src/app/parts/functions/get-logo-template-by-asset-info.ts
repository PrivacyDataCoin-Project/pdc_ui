import { AssetInfo } from '@api/models/assets.model';
import { DEFAULT_ASSET_LOGO_SRC } from '@parts/data/constants';
import { guiLogoForAsset } from '@parts/data/pdc-assets-info';

export const getLogoTemplateByAssetInfo = (asset_info: AssetInfo): string => {
    const { ticker } = asset_info;
    const logo = guiLogoForAsset(asset_info) ?? asset_info.logo;

    if (logo?.includes('<svg')) {
        return logo;
    }
    return `<img alt="${ticker}" src="${logo ?? DEFAULT_ASSET_LOGO_SRC}"/>`;
};
