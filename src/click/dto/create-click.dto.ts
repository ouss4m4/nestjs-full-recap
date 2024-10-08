import { IsNotEmpty } from 'class-validator';

export class CreateClickDto {
  @IsNotEmpty()
  publisherId: number;

  @IsNotEmpty()
  trafficSourceId: number;

  @IsNotEmpty()
  advertiserId: number;

  @IsNotEmpty()
  campaignId: number;

  @IsNotEmpty()
  landerId: number;

  @IsNotEmpty()
  url: string;

  @IsNotEmpty()
  redirect: string;

  @IsNotEmpty()
  revenue: string;

  @IsNotEmpty()
  payout: string;

  @IsNotEmpty()
  ip: string;

  @IsNotEmpty()
  ua: string;

  @IsNotEmpty()
  status: number;
}
