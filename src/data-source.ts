import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'taskdev_db',
  entities: [__dirname + '/**/*.entity{.js,.ts}'],
  migrations: [__dirname + '/migrations/*{.js,.ts}'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
});

export default dataSource;
