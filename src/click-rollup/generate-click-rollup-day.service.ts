import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { format, startOfDay, endOfDay, subMinutes } from 'date-fns';
import { Click } from 'src/click/entities/click.entity';
import { Repository } from 'typeorm';

@Injectable()
export class GenerateClickRollupDay {
  constructor(
    @InjectRepository(Click)
    private clickRepo: Repository<Click>,
  ) {}
  async execute(startDate?: string, endDate?: string) {
    const now = new Date();
    startDate = format(startOfDay(subMinutes(now, 1)), 'yyyy-MM-dd HH:00:00');
    endDate = format(endOfDay(subMinutes(now, 1)), 'yyyy-MM-dd HH:59:59');
    console.log(startDate);
    console.log(endDate);

    const rawQuery = `
      INSERT INTO rollup_campaign_day (
        stat_date,  publisher_id, traffic_source_id, advertiser_id, campaign_id, lander_id, clicks, revenue, payout
      )
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d') as stat_date,
        click.publisher_id,
        click.traffic_source_id,
        click.advertiser_id,
        click.campaign_id,
        click.lander_id, 
        COUNT(*) as clicks,
        SUM(click.revenue) as totalRevenue,
        SUM(click.payout) as totalPayout
      FROM click
      WHERE click.created_at BETWEEN ? AND ?
      GROUP BY stat_date,  click.publisher_id, click.traffic_source_id, click.advertiser_id, click.campaign_id, click.lander_id
      ON DUPLICATE KEY UPDATE 
        clicks = VALUES(clicks),
        revenue = VALUES(revenue),
        payout = VALUES(payout);
    `;
    try {
      await this.clickRepo.query(rawQuery, [startDate, endDate]);
    } catch (error) {
      console.error(error);
    }

    console.log('rollup day generated');
  }
}
