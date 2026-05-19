import { PartialType } from '@nestjs/mapped-types';
import { CreateProvisioningTemplateDto } from './create-provisioning-template.dto';

export class UpdateProvisioningTemplateDto extends PartialType(CreateProvisioningTemplateDto) {}
