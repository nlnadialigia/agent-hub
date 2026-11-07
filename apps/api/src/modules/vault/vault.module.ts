import { Module } from '@nestjs/common';
import { CredentialsVaultService } from './credentials-vault.service';
import { CredentialsVaultController } from './credentials-vault.controller';

@Module({
  controllers: [CredentialsVaultController],
  providers: [CredentialsVaultService],
  exports: [CredentialsVaultService],
})
export class VaultModule {}
