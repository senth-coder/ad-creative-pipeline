import type {Prisma} from '@prisma/client';
import {emptyGovernance,type Governance,type TrackedAsset,type AssetReview,type AssetNaming} from './assurance';
export function readGovernance(value:Prisma.JsonValue|null):Governance{return value?value as unknown as Governance:emptyGovernance();}
export function serializeAsset(a:{id:string;version:number;briefRevision:number;sourceBriefUrl:string|null;sourceUrl:string|null;externalAssetId:string|null;filename:string|null;copyText:string;naming:Prisma.JsonValue|null;revisionNote:string;review:Prisma.JsonValue|null;createdAt:Date;variant:{code:string}}):TrackedAsset{
 return {id:a.id,variantCode:a.variant.code,version:a.version,briefRevision:a.briefRevision,sourceBriefUrl:a.sourceBriefUrl||'',sourceUrl:a.sourceUrl||'',externalAssetId:a.externalAssetId||'',filename:a.filename||'',copyText:a.copyText,naming:a.naming as unknown as AssetNaming,revisionNote:a.revisionNote,review:a.review as unknown as AssetReview|null,createdAt:a.createdAt.toISOString()};
}
