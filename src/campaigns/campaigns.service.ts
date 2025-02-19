import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Brackets, Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CampaignCountry } from './entities/campaign-countries.entity';
import { ICampaignListReponse } from 'src/shared/types';
import { mapCampaignModelToDTO } from 'src/mappers/Campaign.mappers';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { FindAllCampaignsDto } from './types';
import { JwtPayload } from 'src/auth/types';
@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignCountry)
    private campaignCountryRepo: Repository<CampaignCountry>,
  ) {}
  async create(createCampaignDto: CreateCampaignDto) {
    const { countries, ...campaignData } = createCampaignDto;

    const campaign = this.campaignRepo.create(campaignData);

    try {
      const savedCampaign = await this.campaignRepo.save(campaign);

      if (countries && countries.length > 0) {
        const campaignCountries = countries.map((countryId: number) => {
          return this.campaignCountryRepo.create({
            campaign: savedCampaign,
            country: { id: countryId } as any, // Assuming `countryId` is an array of country IDs
          });
        });

        await this.campaignCountryRepo.save(campaignCountries);
      }

      return savedCampaign;
    } catch (error) {
      return error;
    }
  }

  async findAll(
    {
      advId: advertiserId,
      country,
      device,
      lander,
      order,
      page,
      pageSize = 10,
      sortBy,
      status,
    }: FindAllCampaignsDto,
    user: JwtPayload,
  ): Promise<ICampaignListReponse> {
    const queryBuilder = this.campaignRepo.createQueryBuilder('campaign');

    // Include related entities
    queryBuilder
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .leftJoinAndSelect('campaign.lander', 'lander')
      .leftJoinAndSelect('campaign.countries', 'campaignCountries')
      .leftJoinAndSelect('campaignCountries.country', 'countryEntity');

    if (user.role != 'Admin') {
      queryBuilder.andWhere('campaign.advertiserId = :clientId', {
        clientId: user.clientId,
      });
    }
    // Add filters based on query parameters
    if (advertiserId) {
      queryBuilder.andWhere('campaign.advertiserId = :advertiserId', {
        advertiserId: advertiserId,
      });
    }

    if (lander) {
      queryBuilder.andWhere('campaign.landerId = :landerId', {
        landerId: lander,
      });
    }

    if (status) {
      queryBuilder.andWhere('campaign.status = :status', {
        status: status,
      });
    }

    if (device) {
      queryBuilder.andWhere('JSON_CONTAINS(campaign.device, :id, "$")', {
        id: JSON.stringify({ id: Number(device) }), // JSON IS Sensitive to string/number '2' != 2
      });
    }

    if (country && country !== 1) {
      // Ensure the specified country is associated
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where(
            'EXISTS (SELECT 1 FROM campaign_countries cc WHERE cc.campaign_id = campaign.id AND cc.country_id = :country)',
            {
              country: Number(country),
            },
          ).orWhere('campaignCountries.country = 1');
        }),
      );
    }

    if (sortBy && order) {
      switch (sortBy) {
        case 'advertiser':
          sortBy = `advertiser.name`;
          break;
        case 'lander':
          sortBy = `lander.name`;
          break;
        default:
          sortBy = `campaign.${sortBy}`;
          break;
      }

      queryBuilder.orderBy(`${sortBy}`, order == 'asc' ? 'ASC' : 'DESC');
    }

    if (page > 1) {
      queryBuilder.skip((page - 1) * pageSize);
    }

    const [data, rowsCount] = await queryBuilder
      .take(pageSize)
      .getManyAndCount();
    return { data: data.map(mapCampaignModelToDTO), rowsCount };
  }

  async findOne(
    id: number,
    relations: string[] = ['countries.country', 'lander', 'advertiser'],
  ) {
    const campaign = await this.campaignRepo.findOne({
      where: { id },
      withDeleted: true,
      relations,
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }
    return {
      ...campaign,
      countries: campaign.countries.map((campCountry) => ({
        ...campCountry.country,
      })),
    };
  }

  async update(id: number, updateCampaignDto: UpdateCampaignDto) {
    const { countries, ...campaignData } = updateCampaignDto;

    const campaign = await this.findOne(id);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    const newData = Object.assign(campaign, campaignData);
    campaign.advertiser = { id: campaignData.advertiserId } as any;
    campaign.lander = { id: campaignData.advertiserId } as any;
    try {
      const updatedCampaign = await this.campaignRepo.save(newData);

      // TODO: all countries should be handled in validation?
      if (countries && countries.length > 0) {
        // Remove existing associations
        await this.campaignCountryRepo.delete({ campaign: { id } });

        // Add new associations
        const campaignCountries = countries.map((countryId: number) => {
          return this.campaignCountryRepo.create({
            campaign: updatedCampaign,
            country: { id: countryId } as any,
          });
        });

        await this.campaignCountryRepo.save(campaignCountries);
      }
      return updatedCampaign;
    } catch (error) {
      return error;
    }
  }

  async remove(id: number): Promise<boolean> {
    try {
      await this.campaignRepo.softDelete(id);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async export({
    advertiserId,
    landerId,
    status,
    country,
    device,
    sortBy,
    order,
  }: {
    advertiserId?: number;
    landerId?: number;
    status?: number;
    country?: number;
    device?: number;
    sortBy?: string;
    order?: string;
  }) {
    /**
     * STEP1 : GET DATA
     * TODO: Move function to separate folder
     */

    const queryBuilder = this.campaignRepo.createQueryBuilder('campaign');

    // Include related entities
    queryBuilder
      .leftJoinAndSelect('campaign.advertiser', 'advertiser')
      .leftJoinAndSelect('campaign.lander', 'lander')
      .leftJoinAndSelect('campaign.countries', 'campaignCountries')
      .leftJoinAndSelect('campaignCountries.country', 'countryEntity');

    // Add filters based on query parameters
    if (advertiserId) {
      queryBuilder.andWhere('campaign.advertiserId = :advertiserId', {
        advertiserId: advertiserId,
      });
    }

    if (landerId) {
      queryBuilder.andWhere('campaign.landerId = :landerId', {
        landerId: landerId,
      });
    }

    if (status) {
      queryBuilder.andWhere('campaign.status = :status', {
        status: status,
      });
    }

    if (device) {
      queryBuilder.andWhere('JSON_CONTAINS(campaign.device, :id, "$")', {
        id: JSON.stringify({ id: Number(device) }), // JSON IS Sensitive to string/number '2' != 2
      });
    }

    if (country && country !== 1) {
      // Ensure the specified country is associated
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where(
            'EXISTS (SELECT 1 FROM campaign_countries cc WHERE cc.campaign_id = campaign.id AND cc.country_id = :country)',
            {
              country: Number(country),
            },
          ).orWhere('campaignCountries.country = 1');
        }),
      );
    }

    if (sortBy && order) {
      switch (sortBy) {
        case 'advertiser':
          sortBy = `advertiser.name`;
          break;
        case 'lander':
          sortBy = `lander.name`;
          break;
        default:
          sortBy = `campaign.${sortBy}`;
          break;
      }

      queryBuilder.orderBy(`${sortBy}`, order == 'asc' ? 'ASC' : 'DESC');
    }

    const data = await queryBuilder.getMany();
    const formattedData = data.map(mapCampaignModelToDTO);

    // mkdir(join(__dirname, '..', 'exports'), { recursive: true }, (err) => {
    //   console.error(err);
    // });

    const filePath = join(process.cwd(), 'src/exports/campaigns.csv');
    const writeStream = createWriteStream(filePath);
    await new Promise((resolve) => {
      writeStream.write('ID,Name,Status,Advertiser,Lander,Countries,Devices\n');

      formattedData.forEach((campaign) => {
        writeStream.write(
          `"${campaign.id}","${campaign.name}","${campaign.status}","${campaign.advertiser.name}","${campaign.lander.name}","${campaign.countries
            .map((country) => country.name)
            .join(',')}","${campaign.device
            .map((device) => device.name)
            .join(',')}"\n`,
        );
      });
      writeStream.end();
      writeStream.on('finish', () => resolve(''));
    });
    return filePath;
  }
  catch(error) {
    console.error('Error exporting campaigns to CSV:', error);
    throw error;
  }
}
