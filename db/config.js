
// Update with your config settings.

module.exports = {
    development: {
        client: 'pg',
        connection: {
            host: 'localhost',
            port: 5432,
            user: 'postgres',
            password: '12345',
            database: 'debatotron'
        }
    },
    production: {
        client: 'pg',
        connection: {
            connectionString: process.env.PROD_POSTGRES_CONNECTION_STRING,
        }
    }
};

