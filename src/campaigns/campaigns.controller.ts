import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ICampaignListReponse } from 'src/shared/types';
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  create(@Body() createCampaignDto: CreateCampaignDto) {
    return this.campaignsService.create(createCampaignDto);
  }

  @Get()
  async findAll(
    @Query('advId') advertiserId: number,
    @Query('status') status: number,
    @Query('country') country: number,
    @Query('device') device: number,
    @Query('page') page: number,
  ): Promise<ICampaignListReponse> {
    const options: {
      advertiserId?: number;
      status?: number;
      country?: number;
      page?: number;
      device?: number;
    } = {};
    if (advertiserId) options['advertiserId'] = advertiserId;
    if (status) options['status'] = status;
    if (country) options['country'] = country;
    if (page) options['page'] = page;
    if (device) options['device'] = device;

    return await this.campaignsService.findAll(options);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(+id, updateCampaignDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campaignsService.remove(+id);
  }
}
