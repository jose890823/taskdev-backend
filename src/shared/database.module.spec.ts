import { resolveTypeOrmSynchronize } from './database.module';

describe('resolveTypeOrmSynchronize', () => {
  it('keeps synchronization disabled in production despite legacy overrides', () => {
    const productionEnvironment = {
      NODE_ENV: 'production',
      TYPEORM_SYNC: 'true',
      TYPEORM_SYNC_CONFIRM: 'I_KNOW_WHAT_I_AM_DOING',
    };

    expect(resolveTypeOrmSynchronize(productionEnvironment)).toBe(false);
  });

  it('keeps development synchronization enabled', () => {
    expect(resolveTypeOrmSynchronize({ NODE_ENV: 'development' })).toBe(true);
  });
});
